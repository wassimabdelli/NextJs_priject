import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { HttpError, json, parseBody } from "@/lib/api";
import { withAuth, type AuthUser } from "@/lib/auth-guard";
import {
  loadTaskForActor,
  MAINTENANCE_POPULATE,
  syncEquipmentStatus,
} from "@/lib/maintenance/service";
import {
  computeNextMaintenanceDate,
  OPEN_MAINTENANCE_STATUSES,
} from "@/lib/maintenance/workflow";
import { maintenanceCompleteSchema } from "@/lib/validations/maintenance";
import { Equipment } from "@/models/Equipment";
import { Expense } from "@/models/Expense";
import { MaintenanceTask } from "@/models/MaintenanceTask";
import { StockItem } from "@/models/StockItem";
import { StockMovement } from "@/models/StockMovement";
import {
  ExpenseCategory,
  MaintenanceStatus,
  Role,
  StockMovementType,
} from "@/types/enums";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

/**
 * POST /api/maintenance/[id]/complete : clôture transactionnelle d'une intervention
 * avec décrémentation du stock et génération de dépenses de réapprovisionnement.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthUser, context: RouteContext) => {
    const { id } = await Promise.resolve(context.params);
    const body = await parseBody(req, maintenanceCompleteSchema);
    const { usedItems = [], ...closeFields } = body;
    const task = await loadTaskForActor(id, user);

    if (
      task.status === MaintenanceStatus.DONE ||
      task.status === MaintenanceStatus.COMPLETED
    ) {
      const existing = await MaintenanceTask.findById(task._id)
        .populate(MAINTENANCE_POPULATE)
        .lean();
      return json(existing, 200);
    }

    if (task.status === MaintenanceStatus.CANCELLED) {
      throw new HttpError(409, "Intervention annulée : clôture impossible");
    }

    const completedAt = closeFields.completedAt ?? new Date();
    const cost = closeFields.cost ?? task.cost;
    const notes = closeFields.notes ?? task.notes;
    const checklist = closeFields.checklist
      ? closeFields.checklist.map((i) => ({
          label: i.label,
          done: i.done ?? false,
        }))
      : task.checklist;

    console.log(
      `[MaintenanceComplete] Début clôture intervention ${id} | usedItems reçus :`,
      JSON.stringify(usedItems)
    );

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Passe le statut de la Maintenance Task à COMPLETED
        const claimed = await MaintenanceTask.findOneAndUpdate(
          { _id: task._id, status: { $in: OPEN_MAINTENANCE_STATUSES } },
          {
            $set: {
              status: MaintenanceStatus.COMPLETED,
              completedAt,
              cost,
              notes,
              checklist,
            },
          },
          { new: true, runValidators: true, session }
        );

        if (!claimed) {
          throw new HttpError(409, "Clôture impossible");
        }

        const eq = await Equipment.findById(task.equipment, null, { session }).lean();

        // 2. Création de dépense de maintenance si cost > 0
        if (cost > 0 && !claimed.expense) {
          const description = eq?.name
            ? `Maintenance : ${task.title} (${eq.name})`
            : `Maintenance : ${task.title}`;
          const newMaintExpense = new Expense({
            residence: task.residence,
            category: ExpenseCategory.MAINTENANCE,
            description,
            amount: cost,
            expenseDate: completedAt,
          });
          await newMaintExpense.save({ session });

          await MaintenanceTask.findByIdAndUpdate(
            task._id,
            { $set: { expense: newMaintExpense._id } },
            { session }
          );
        }

        // 3. Traitement des pièces utilisées (Stock -> Mouvement -> Dépense en cas d'alerte)
        for (const used of usedItems) {
          const qty = Number(used.quantity);
          const currentItem = await StockItem.findById(used.itemId, null, { session });
          if (!currentItem) {
            throw new HttpError(404, `Article de stock introuvable (${used.itemId})`);
          }
          if (currentItem.quantity < qty) {
            throw new HttpError(
              400,
              `Stock insuffisant pour l'article "${currentItem.name}" (disponible : ${currentItem.quantity})`
            );
          }

          console.log(
            `[MaintenanceComplete] Avant décrémentation StockItem ${currentItem._id} (${currentItem.name}) : quantity=${currentItem.quantity}, retrait=${qty}`
          );

          // a. Décrémente atomiquement la quantity du StockItem correspondant avec { session }
          const updatedStockItem = await StockItem.findByIdAndUpdate(
            used.itemId,
            { $inc: { quantity: -qty } },
            { new: true, runValidators: true, session }
          );

          if (!updatedStockItem) {
            throw new HttpError(404, `Échec de mise à jour du stock (${used.itemId})`);
          }

          console.log(
            `[MaintenanceComplete] Après décrémentation StockItem ${updatedStockItem._id} (${updatedStockItem.name}) : nouvelle quantity=${updatedStockItem.quantity}`
          );

          // b. Crée un document StockMovement (type: 'OUT', reference: maintenanceId) avec { session }
          const newMovement = new StockMovement({
            residence: updatedStockItem.residence,
            item: updatedStockItem._id,
            type: StockMovementType.OUT,
            quantity: qty,
            reference: String(task._id),
            reason: `Intervention : ${task.title}`,
            performedBy: user.id,
            movementDate: completedAt,
          });
          await newMovement.save({ session });

          // c. Vérifie si la nouvelle quantité est <= au seuil d'alerte (minQuantity, alertThreshold ou minThreshold)
          const alertLimit =
            updatedStockItem.minQuantity ??
            updatedStockItem.alertThreshold ??
            updatedStockItem.minThreshold ??
            0;

          // d. Si le seuil est franchi, crée un document Expense de réapprovisionnement avec { session }
          if (updatedStockItem.quantity <= alertLimit) {
            console.log(
              `[MaintenanceComplete] Seuil d'alerte franchi pour "${updatedStockItem.name}" (${updatedStockItem.quantity} <= ${alertLimit}) -> Création Expense DRAFT/SUPPLIES`
            );
            const newSupplyExpense = new Expense({
              residence: updatedStockItem.residence,
              status: "DRAFT",
              category: ExpenseCategory.SUPPLIES,
              amount: 0,
              description: "Réapprovisionnement automatique suite à intervention",
              expenseDate: completedAt,
            });
            await newSupplyExpense.save({ session });
          }
        }

        // 4. Mise à jour des dates d'entretien de l'équipement avec { session }
        if (
          eq &&
          (!eq.lastMaintenanceDate ||
            completedAt.getTime() >= new Date(eq.lastMaintenanceDate).getTime())
        ) {
          await Equipment.findByIdAndUpdate(
            eq._id,
            {
              $set: {
                lastMaintenanceDate: completedAt,
                nextMaintenanceDate: computeNextMaintenanceDate(
                  completedAt,
                  eq.maintenanceIntervalDays
                ),
              },
            },
            { session }
          );
        }
      });
    } catch (txError) {
      console.error(
        `[MaintenanceComplete] Erreur critique lors de la transaction pour l'intervention ${id} :`,
        txError
      );
      throw txError;
    } finally {
      await session.endSession();
    }

    // Synchronisation du statut de l'équipement après validation de la transaction
    await syncEquipmentStatus(task.equipment);

    const updated = await MaintenanceTask.findById(task._id)
      .populate(MAINTENANCE_POPULATE)
      .lean();

    return json(updated, 200);
  },
  { roles: [Role.ADMIN, Role.SYNDIC, Role.TECHNICIAN] }
);
