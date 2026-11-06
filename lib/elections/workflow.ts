import { Election, type IElection } from "@/models/Election";
import { ElectionVote } from "@/models/ElectionVote";
import { Announcement } from "@/models/Announcement";
import { Residence } from "@/models/Residence";
import { User } from "@/models/User";
import { ElectionPhase, Role } from "@/types/enums";

/**
 * Vérifie et effectue les transitions automatiques de phase selon l'horodatage.
 */
export async function checkAndProgressElection(election: any) {
  const now = new Date();
  let modified = false;

  // 1. Transition CANDIDACY -> VOTING
  if (
    election.phase === ElectionPhase.CANDIDACY &&
    now >= new Date(election.candidacyEndDate)
  ) {
    election.phase = ElectionPhase.VOTING;
    modified = true;

    if (!election.announcements?.votingAnnounced) {
      const candidatesCount = election.candidates?.length || 0;
      const votingEndStr = new Date(election.votingEndDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

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

        // Mise à jour de la résidence avec le nouveau syndic
        await Residence.findByIdAndUpdate(election.residence, {
          syndic: winnerUser._id,
        });

        // Mise à jour du rôle utilisateur si nécessaire
        if (winnerUser.role === Role.OWNER) {
          winnerUser.role = Role.SYNDIC;
          await winnerUser.save();
        }
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
        await Residence.findByIdAndUpdate(election.residence, {
          syndic: winnerUser._id,
        });
      }
    }

    if (!election.announcements?.resultsAnnounced) {
      const winnerName = election.winner?.name;
      const count = election.winner?.votesCount ?? 0;
      const weight = election.winner?.votesWeight ?? 0;

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
  }

  return election;
}

