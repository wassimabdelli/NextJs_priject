import { User } from "@/models/User";
import { Incident } from "@/models/Incident";
import { IncidentCategory, IncidentStatus, Role } from "@/types/enums";

/**
 * Choisit un technicien actif dont les spécialités matchent la catégorie,
 * sinon n'importe quel technicien, en privilégiant le moins chargé.
 */
export async function findTechnicianForCategory(
  _residenceId: string,
  category: IncidentCategory
): Promise<string | null> {
  let technicians = await User.find({
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: category,
  })
    .select("_id")
    .lean();

  if (technicians.length === 0) {
    technicians = await User.find({ role: Role.TECHNICIAN, isActive: true })
      .select("_id")
      .lean();
  }

  if (technicians.length === 0) return null;
  return pickLeastBusy(technicians.map((t) => String(t._id)));
}

async function pickLeastBusy(technicianIds: string[]): Promise<string> {
  const openStatuses: IncidentStatus[] = [
    IncidentStatus.REPORTED,
    IncidentStatus.ASSIGNED,
    IncidentStatus.IN_PROGRESS,
  ];
  const counts = await Promise.all(
    technicianIds.map(async (id) => {
      const n = await Incident.countDocuments({
        assignedTo: id,
        status: { $in: openStatuses },
      });
      return { id, n };
    })
  );
  counts.sort((a, b) => a.n - b.n);
  return counts[0].id;
}
