import { Election, type IElection } from "@/models/Election";
import { ElectionVote } from "@/models/ElectionVote";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { User } from "@/models/User";
import { notifyUser } from "@/lib/notifications/notify";
import { ElectionPhase, ReminderType, Role } from "@/types/enums";

interface ElectionNotifyInput {
  electionId: unknown;
  residenceId: unknown;
  title: string;
  phase: ElectionPhase;
  summary: string;
}

/**
 * Notifie tous les administrateurs actifs (In-App + WhatsApp/Push selon leurs préférences)
 * au lancement ou lors d'un changement de phase d'une élection.
 */
export async function notifyAdminsElectionPhase(
  input: ElectionNotifyInput
): Promise<void> {
  try {
    const rawResId =
      typeof input.residenceId === "object" &&
      input.residenceId !== null &&
      "_id" in input.residenceId
        ? (input.residenceId as { _id: unknown })._id
        : input.residenceId;
    const populatedName =
      typeof input.residenceId === "object" &&
      input.residenceId !== null &&
      "name" in input.residenceId
        ? String((input.residenceId as { name?: string }).name || "")
        : "";

    let residenceName = populatedName;
    if (!residenceName && rawResId) {
      const res = await Residence.findById(rawResId).select("name").lean();
      residenceName = res?.name || "";
    }

    const admins = await User.find({ role: Role.ADMIN, isActive: true })
      .select("_id")
      .lean();

    const phaseTitles: Record<ElectionPhase, string> = {
      [ElectionPhase.CANDIDACY]: "Nouvelle élection lancée",
      [ElectionPhase.VOTING]: "Élection : ouverture des votes",
      [ElectionPhase.COMPLETED]: "Élection terminée : résultats",
    };

    const notifTitle = phaseTitles[input.phase];
    const body = `${input.title} (${residenceName || "Résidence"}) — ${input.summary}`;

    for (const admin of admins) {
      const adminId = String(admin._id);
      await notifyUser({
        userId: adminId,
        type: ReminderType.ELECTION_UPDATE,
        title: notifTitle,
        body,
        dedupeKey: `election:${String(input.electionId)}:phase:${input.phase}:${adminId}`,
        meta: {
          electionId: String(input.electionId),
          phase: input.phase,
        },
      });
    }
  } catch (err) {
    console.error("[elections] Échec notification admins:", err);
  }
}

/**
 * Affecte le gagnant comme syndic de la résidence.
 * Rétrograde l'ancien syndic en OWNER s'il ne gère plus aucune résidence.
 */
async function assignElectionWinnerAsSyndic(
  residenceId: unknown,
  winnerUser: { _id: unknown; role: string; save: () => Promise<unknown> }
) {
  const residence = await Residence.findById(residenceId).select("syndic");
  const previousSyndicId = residence?.syndic ? String(residence.syndic) : null;
  const winnerId = String(winnerUser._id);

  await Residence.findByIdAndUpdate(residenceId, { syndic: winnerUser._id });

  if (winnerUser.role === Role.OWNER) {
    winnerUser.role = Role.SYNDIC;
    await winnerUser.save();
  }

  if (previousSyndicId && previousSyndicId !== winnerId) {
    const stillManages = await Residence.exists({
      syndic: previousSyndicId,
      _id: { $ne: residenceId },
    });
    if (!stillManages) {
      await User.findOneAndUpdate(
        { _id: previousSyndicId, role: Role.SYNDIC },
        { role: Role.OWNER }
      );
    }
  }
}

/**
 * Vérifie et effectue les transitions automatiques de phase selon l'horodatage.
 */
export async function checkAndProgressElection(election: any) {
  const now = new Date();
  let modified = false;
  let votingSummary: string | null = null;
  let completedSummary: string | null = null;

  // 1. Transition CANDIDACY -> VOTING
  if (
    election.phase === ElectionPhase.CANDIDACY &&
    now >= new Date(election.candidacyEndDate)
  ) {
    election.phase = ElectionPhase.VOTING;
    modified = true;

    const candidatesCount = election.candidates?.length || 0;
    const votingEndStr = new Date(election.votingEndDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    votingSummary = `Votes ouverts (${candidatesCount} candidat(s)) jusqu'au ${votingEndStr}.`;

    if (!election.announcements?.votingAnnounced) {
      await Announcement.create({
        residence: election.residence,
        author: election.createdBy,
        title: "🗳️ Lancement des votes : Élection du nouveau syndic",
        content: `La phase de dépôt des candidatures est terminée (${candidatesCount} candidat(s) en lice). Les votes sont officiellement ouverts jusqu'au ${votingEndStr}. Tous les copropriétaires sont invités à voter.`,
        isPinned: true,
        publishedAt: new Date(),
      });

      election.announcements = {
        ...election.announcements,
        votingAnnounced: true,
      };
    }
  }

  // 2. Transition VOTING -> COMPLETED
  if (
    election.phase === ElectionPhase.VOTING &&
    now >= new Date(election.votingEndDate)
  ) {
    election.phase = ElectionPhase.COMPLETED;
    modified = true;

    // Décompte des suffrages
    const tally = await ElectionVote.aggregate([
      { $match: { election: election._id } },
      {
        $group: {
          _id: "$candidate",
          count: { $sum: 1 },
          weight: { $sum: "$weight" },
        },
      },
      { $sort: { weight: -1, count: -1 } },
    ]);

    let winnerUser: any = null;
    if (tally.length > 0) {
      winnerUser = await User.findById(tally[0]._id);
      if (winnerUser) {
        election.winner = {
          user: winnerUser._id,
          name: winnerUser.name,
          votesCount: tally[0].count,
          votesWeight: tally[0].weight,
        };

        await assignElectionWinnerAsSyndic(election.residence, winnerUser);
      }
    } else if (election.candidates && election.candidates.length === 1) {
      // Un seul candidat sans vote : élu par défaut
      const singleCandidate = election.candidates[0];
      winnerUser = await User.findById(singleCandidate.user);
      if (winnerUser) {
        election.winner = {
          user: winnerUser._id,
          name: winnerUser.name,
          votesCount: 0,
          votesWeight: 0,
        };
        await assignElectionWinnerAsSyndic(election.residence, winnerUser);
      }
    }

    const winnerName = election.winner?.name;
    const count = election.winner?.votesCount ?? 0;
    const weight = election.winner?.votesWeight ?? 0;
    completedSummary = winnerName
      ? `Scrutin clos — Vainqueur : ${winnerName} (${count} vote(s)).`
      : "Scrutin clos — Aucun vote enregistré.";

    if (!election.announcements?.resultsAnnounced) {
      await Announcement.create({
        residence: election.residence,
        author: election.createdBy,
        title: "🏆 Proclamation des résultats : Nouveau syndic élu",
        content: winnerName
          ? `Le scrutin est clos. Félicitations à ${winnerName} qui est officiellement élu(e) nouveau syndic avec ${count} suffrage(s) (${weight} tantièmes exprimés) !`
          : "Le scrutin est clos. Aucun vote n'a été enregistré lors de cette élection.",
        isPinned: true,
        publishedAt: new Date(),
      });

      election.announcements = {
        ...election.announcements,
        resultsAnnounced: true,
      };
    }
  }

  if (modified) {
    await election.save();

    if (votingSummary) {
      await notifyAdminsElectionPhase({
        electionId: election._id,
        residenceId: election.residence,
        title: election.title,
        phase: ElectionPhase.VOTING,
        summary: votingSummary,
      });
    }
    if (completedSummary) {
      await notifyAdminsElectionPhase({
        electionId: election._id,
        residenceId: election.residence,
        title: election.title,
        phase: ElectionPhase.COMPLETED,
        summary: completedSummary,
      });
    }
  }

  return election;
}

