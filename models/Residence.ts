import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { IncidentStatus } from "@/types/enums";
import { Apartment } from "./Apartment";
import { Charge } from "./Charge";
import { Payment } from "./Payment";
import { Expense } from "./Expense";
import { Incident, type IncidentDocument } from "./Incident";

export interface IResidence {
  name: string;
  address: string;
  city: string;
  floors: number;
  totalApartments: number;
  syndic?: Types.ObjectId;
}

type Id = Types.ObjectId | string;

export interface ResidenceStatics {
  /** % du montant appelé effectivement encaissé sur une période "YYYY-MM". */
  getCollectionRate(residenceId: Id, period: string): Promise<number>;
  /** Trésorerie = somme des paiements - somme des dépenses. */
  getBalance(residenceId: Id): Promise<{ payments: number; expenses: number; balance: number }>;
  /** Incidents non résolus, du plus récent au plus ancien. */
  getOpenIncidents(residenceId: Id): Promise<IncidentDocument[]>;
}

export type ResidenceModel = Model<IResidence> & ResidenceStatics;

const ResidenceSchema = new Schema<IResidence, ResidenceModel, {}, {}, {}, ResidenceStatics>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    floors: { type: Number, required: true, min: 0 },
    totalApartments: { type: Number, required: true, min: 0 },
    syndic: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const toId = (id: Id) => new mongoose.Types.ObjectId(String(id));

/** Liste des _id d'appartements d'une résidence (charges/paiements y sont rattachés indirectement). */
async function apartmentIds(residenceId: Id) {
  return Apartment.find({ residence: toId(residenceId) }).distinct("_id");
}

ResidenceSchema.static("getCollectionRate", async function (residenceId: Id, period: string) {
  const ids = await apartmentIds(residenceId);
  const [agg] = await Charge.aggregate<{ amount: number; paid: number }>([
    { $match: { apartment: { $in: ids }, period } },
    { $group: { _id: null, amount: { $sum: "$amount" }, paid: { $sum: "$paidAmount" } } },
  ]);
  if (!agg || agg.amount === 0) return 0;
  return Math.round((Math.min(agg.paid, agg.amount) / agg.amount) * 1000) / 10;
});

ResidenceSchema.static("getBalance", async function (residenceId: Id) {
  const ids = await apartmentIds(residenceId);
  const chargeIds = await Charge.find({ apartment: { $in: ids } }).distinct("_id");
  const [[p], [e]] = await Promise.all([
    Payment.aggregate<{ total: number }>([
      { $match: { charge: { $in: chargeIds } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate<{ total: number }>([
      { $match: { residence: toId(residenceId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const payments = p?.total ?? 0;
  const expenses = e?.total ?? 0;
  return { payments, expenses, balance: Math.round((payments - expenses) * 100) / 100 };
});

ResidenceSchema.static("getOpenIncidents", async function (residenceId: Id) {
  return Incident.find({
    residence: toId(residenceId),
    status: { $ne: IncidentStatus.RESOLVED },
  }).sort({ reportedAt: -1 });
});

export const Residence =
  (mongoose.models.Residence as ResidenceModel) ||
  model<IResidence, ResidenceModel>("Residence", ResidenceSchema);
