import mongoose, { Schema, model, type Model, type Types } from "mongoose";

export interface IApartment {
  residence: Types.ObjectId;
  number: string;
  floor: number;
  surface: number;
  /** Tantièmes (quote-part des parties communes) */
  shares: number;
  isOccupied: boolean;
  owner?: Types.ObjectId;
}

interface ApartmentStatics {
  /**
   * Charge mensuelle d'un lot = totalBudget * tantièmes du lot / somme des tantièmes de la résidence.
   * Statique async car il faut interroger tous les lots de la résidence.
   */
  calculateMonthlyCharge(apartmentId: Types.ObjectId | string, totalBudget: number): Promise<number>;
  /** Somme des tantièmes d'une résidence. */
  totalShares(residenceId: Types.ObjectId | string): Promise<number>;
}

export type ApartmentModel = Model<IApartment> & ApartmentStatics;

const ApartmentSchema = new Schema<IApartment, ApartmentModel, {}, {}, {}, ApartmentStatics>(
  {
    residence: { type: Schema.Types.ObjectId, ref: "Residence", required: true },
    number: { type: String, required: true, trim: true },
    floor: { type: Number, required: true, min: 0 },
    surface: { type: Number, required: true, min: 0 },
    shares: { type: Number, required: true, min: 0 },
    isOccupied: { type: Boolean, default: false },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Un numéro de lot est unique au sein d'une résidence
ApartmentSchema.index({ residence: 1, number: 1 }, { unique: true });

ApartmentSchema.static("totalShares", async function (residenceId: Types.ObjectId | string) {
  const [res] = await Apartment.aggregate<{ total: number }>([
    { $match: { residence: new mongoose.Types.ObjectId(String(residenceId)) } },
    { $group: { _id: null, total: { $sum: "$shares" } } },
  ]);
  return res?.total ?? 0;
});

ApartmentSchema.static(
  "calculateMonthlyCharge",
  async function (apartmentId: Types.ObjectId | string, totalBudget: number) {
    const apt = await Apartment.findById(apartmentId).lean();
    if (!apt) throw new Error("Appartement introuvable");
    const total = await Apartment.totalShares(apt.residence);
    if (total === 0) return 0;
    // Arrondi au centime
    return Math.round(((totalBudget * apt.shares) / total) * 100) / 100;
  }
);

export const Apartment =
  (mongoose.models.Apartment as ApartmentModel) ||
  model<IApartment, ApartmentModel>("Apartment", ApartmentSchema);
