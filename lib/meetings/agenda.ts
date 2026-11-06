import { Meeting } from "@/models/Meeting";
import { Resolution } from "@/models/Resolution";
import { Incident } from "@/models/Incident";
import { Charge } from "@/models/Charge";
import { Apartment } from "@/models/Apartment";
import { ChargeStatus, IncidentStatus } from "@/types/enums";

/**
 * Génère un ordre du jour structuré à partir des résolutions,
 * incidents ouverts et impayés de la résidence.
 */
export async function generateMeetingAgenda(meetingId: string): Promise<{
  agendaItems: string[];
  agenda: string;
}> {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error("Assemblée introuvable");

  const items: string[] = [
    "1. Ouverture de séance et vérification du quorum",
    "2. Approbation du procès-verbal de la précédente AG",
  ];
  let n = 3;

  const resolutions = await Resolution.find({ meeting: meeting._id })
    .select("title requiredMajority")
    .lean();
  for (const r of resolutions) {
    items.push(
      `${n}. Résolution : ${r.title} (majorité ${r.requiredMajority} %)`
    );
    n += 1;
  }

  const openIncidents = await Incident.find({
    residence: meeting.residence,
    status: { $ne: IncidentStatus.RESOLVED },
  })
    .select("title category priority")
    .limit(8)
    .lean();
  if (openIncidents.length > 0) {
    items.push(`${n}. Point technique — incidents ouverts (${openIncidents.length})`);
    n += 1;
    for (const inc of openIncidents.slice(0, 5)) {
      items.push(`   · [${inc.priority}] ${inc.title} (${inc.category})`);
    }
  }

  const aptIds = await Apartment.find({ residence: meeting.residence }).distinct("_id");
  const overdueCount = await Charge.countDocuments({
    apartment: { $in: aptIds },
    status: { $in: [ChargeStatus.OVERDUE, ChargeStatus.PARTIAL, ChargeStatus.PENDING] },
  });
  if (overdueCount > 0) {
    items.push(`${n}. Situation des charges — ${overdueCount} lot(s) non à jour`);
    n += 1;
  }

  items.push(`${n}. Questions diverses`);
  items.push(`${n + 1}. Clôture de séance`);

  const agenda = items.join("\n");
  meeting.agendaItems = items;
  meeting.agenda = agenda;
  await meeting.save();

  return { agendaItems: items, agenda };
}
