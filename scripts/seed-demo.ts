import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Chargement automatique du .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      const val = values.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import { connectDB } from "../lib/db";
import { User } from "../models/User";
import { Residence } from "../models/Residence";
import { Apartment } from "../models/Apartment";
import { Resident } from "../models/Resident";
import { Charge } from "../models/Charge";
import { Payment } from "../models/Payment";
import { Expense } from "../models/Expense";
import { Incident } from "../models/Incident";
import { Announcement } from "../models/Announcement";
import { Meeting } from "../models/Meeting";
import { Resolution } from "../models/Resolution";
import { Vote } from "../models/Vote";
import { ResidenceDocument } from "../models/Document";
import {
  Role,
  ResidentType,
  ChargeStatus,
  PaymentMethod,
  ExpenseCategory,
  IncidentCategory,
  Priority,
  IncidentStatus,
  MeetingStatus,
  VoteChoice,
  DocumentType,
} from "../types/enums";

async function runDemoSeed() {
  console.log("🌱 Démarrage de l'injection des données de démonstration SyndicPro...");
  await connectDB();

  console.log("🧹 Nettoyage des collections...");
  const collections = await mongoose.connection.db!.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }

  // 1. Création des utilisateurs
  console.log("👤 Création des 4 utilisateurs de test...");
  const salt = bcrypt.genSaltSync(10);
  const adminUser = await User.create({
    name: "Administrateur Système",
    email: "admin@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Admin123!", salt),
    phone: "20 000 001",
    role: Role.ADMIN,
    isActive: true,
  });

  const syndicUser = await User.create({
    name: "Mohamed Syndic",
    email: "syndic@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Syndic123!", salt),
    phone: "20 000 002",
    role: Role.SYNDIC,
    isActive: true,
  });

  const techUser = await User.create({
    name: "Sami Technicien",
    email: "tech@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Tech123!", salt),
    phone: "20 000 003",
    role: Role.TECHNICIAN,
    isActive: true,
  });

  const residentUser = await User.create({
    name: "Yassine Résident",
    email: "resident@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Resident123!", salt),
    phone: "20 000 004",
    role: Role.OWNER,
    isActive: true,
  });

  // 2. Création de résidences
  console.log("🏢 Création des résidences...");
  const residence1 = await Residence.create({
    name: "Résidence Les Jasmins",
    address: "15 Avenue Habib Bourguiba",
    city: "Tunis",
    floors: 5,
    totalApartments: 8,
    syndic: syndicUser._id,
  });

  const residence2 = await Residence.create({
    name: "Résidence Palm Beach",
    address: "Route Touristique",
    city: "La Marsa",
    floors: 3,
    totalApartments: 6,
    syndic: syndicUser._id,
  });

  // 3. Création des appartements
  console.log("🚪 Création des appartements...");
  const appt101 = await Apartment.create({
    residence: residence1._id,
    number: "A101",
    floor: 1,
    surface: 95,
    shares: 120,
    isOccupied: true,
    owner: residentUser._id,
  });

  const appt102 = await Apartment.create({
    residence: residence1._id,
    number: "A102",
    floor: 1,
    surface: 75,
    shares: 90,
    isOccupied: true,
  });

  const appt201 = await Apartment.create({
    residence: residence1._id,
    number: "A201",
    floor: 2,
    surface: 110,
    shares: 140,
    isOccupied: false,
  });

  const appt202 = await Apartment.create({
    residence: residence1._id,
    number: "A202",
    floor: 2,
    surface: 80,
    shares: 100,
    isOccupied: true,
  });

  // 4. Création des fiches résidents
  console.log("👥 Création des fiches résidents...");
  await Resident.create({
    apartment: appt101._id,
    user: residentUser._id,
    fullName: residentUser.name,
    email: residentUser.email,
    phone: residentUser.phone,
    type: ResidentType.OWNER,
    moveInDate: new Date("2024-01-15"),
    isActive: true,
  });

  await Resident.create({
    apartment: appt102._id,
    fullName: "Karim Ben Salah",
    email: "karim.bensalah@email.tn",
    phone: "98 123 456",
    type: ResidentType.TENANT,
    moveInDate: new Date("2024-06-01"),
    isActive: true,
  });

  // 5. Charges et Paiements
  console.log("💰 Création des charges et paiements...");
  const chargeJan = await Charge.create({
    apartment: appt101._id,
    period: "2026-01",
    amount: 150,
    paidAmount: 150,
    dueDate: new Date("2026-01-20"),
    status: ChargeStatus.PAID,
  });

  await Payment.create({
    charge: chargeJan._id,
    receivedBy: syndicUser._id,
    amount: 150,
    paymentDate: new Date("2026-01-12"),
    method: PaymentMethod.BANK_TRANSFER,
    receiptNumber: "REC-20260112-JAS01",
  });

  const chargeFeb = await Charge.create({
    apartment: appt101._id,
    period: "2026-02",
    amount: 150,
    paidAmount: 0,
    dueDate: new Date("2026-02-20"),
    status: ChargeStatus.PENDING,
  });

  const chargeRetard = await Charge.create({
    apartment: appt102._id,
    period: "2025-12",
    amount: 120,
    paidAmount: 50,
    dueDate: new Date("2025-12-20"),
    status: ChargeStatus.PARTIAL,
  });

  await Payment.create({
    charge: chargeRetard._id,
    receivedBy: syndicUser._id,
    amount: 50,
    paymentDate: new Date("2025-12-22"),
    method: PaymentMethod.CASH,
    receiptNumber: "REC-20251222-JAS02",
  });

  // 6. Dépenses de la copropriété
  console.log("🧾 Création des dépenses...");
  await Expense.create({
    residence: residence1._id,
    category: ExpenseCategory.ELEVATOR,
    description: "Contrat de maintenance trimestriel Schindler",
    amount: 380,
    expenseDate: new Date("2026-01-10"),
  });

  await Expense.create({
    residence: residence1._id,
    category: ExpenseCategory.ELECTRICITY,
    description: "Facture STEG éclairage parties communes",
    amount: 165,
    expenseDate: new Date("2026-01-18"),
  });

  await Expense.create({
    residence: residence1._id,
    category: ExpenseCategory.CLEANING,
    description: "Prestation nettoyage des paliers et hall Janvier",
    amount: 220,
    expenseDate: new Date("2026-01-30"),
  });

  // 7. Incidents et signalements
  console.log("⚠️ Création des incidents...");
  await Incident.create({
    residence: residence1._id,
    apartment: appt101._id,
    reportedBy: residentUser._id,
    assignedTo: techUser._id,
    title: "Fuite d'eau au sous-sol près du parking",
    description: "Une flaque d'eau importante stagne à côté de la place n°4. Risque de glissade.",
    category: IncidentCategory.PLUMBING,
    priority: Priority.HIGH,
    status: IncidentStatus.IN_PROGRESS,
    reportedAt: new Date("2026-02-01"),
    createdOffline: false,
  });

  await Incident.create({
    residence: residence1._id,
    apartment: appt102._id,
    reportedBy: residentUser._id,
    title: "Interphone ne sonne plus",
    description: "Les visiteurs ne peuvent plus sonner depuis la porte d'entrée de la résidence.",
    category: IncidentCategory.ELECTRICITY,
    priority: Priority.MEDIUM,
    status: IncidentStatus.REPORTED,
    reportedAt: new Date("2026-02-02"),
    createdOffline: false,
  });

  await Incident.create({
    residence: residence1._id,
    reportedBy: syndicUser._id,
    assignedTo: techUser._id,
    title: "Remplacement bloc de secours 2ème étage",
    description: "La lampe de secours ne s'allumait plus lors du test de sécurité.",
    category: IncidentCategory.SECURITY,
    priority: Priority.LOW,
    status: IncidentStatus.RESOLVED,
    reportedAt: new Date("2026-01-15"),
    resolvedAt: new Date("2026-01-16"),
    createdOffline: false,
  });

  // 8. Annonces du syndic
  console.log("📢 Création des annonces...");
  await Announcement.create({
    residence: residence1._id,
    author: syndicUser._id,
    title: "Nettoyage annuel des parkings en sous-sol",
    content: "Le nettoyage haute pression des sous-sols aura lieu ce samedi à partir de 8h30. Merci de stationner vos véhicules à l'extérieur.",
    publishedAt: new Date(),
    isPinned: true,
  });

  await Announcement.create({
    residence: residence1._id,
    author: syndicUser._id,
    title: "Horaires de ramassage des ordures ménagères",
    content: "Rappel à tous les résidents : les poubelles doivent être déposées dans le local technique après 19h.",
    publishedAt: new Date("2026-01-25"),
    isPinned: false,
  });

  // 9. Assemblée Générale et Résolutions
  console.log("🗳️ Création de l'AG et des résolutions...");
  const meeting = await Meeting.create({
    residence: residence1._id,
    title: "Assemblée Générale Ordinaire 2026",
    date: new Date("2026-03-15T18:30:00.000Z"),
    location: "Salle polyvalente / Visioconférence",
    agenda: "1. Bilan financier 2025\n2. Budget 2026\n3. Vote pour l'installation de caméras de surveillance",
    status: MeetingStatus.OPEN,
  });

  const res1 = await Resolution.create({
    meeting: meeting._id,
    title: "Résolution 1 : Approbation des comptes de l'exercice 2025",
    description: "Quitus au syndic pour la gestion comptable de l'année écoulée.",
    requiredMajority: 50,
  });

  const res2 = await Resolution.create({
    meeting: meeting._id,
    title: "Résolution 2 : Installation d'un système de vidéosurveillance",
    description: "Pose de 4 caméras dans les halls et parkings pour un budget max de 2 800 TND.",
    requiredMajority: 66,
  });

  // 10. Votes
  console.log("🗳️ Enregistrement d'un vote de test...");
  await Vote.create({
    resolution: res1._id,
    apartment: appt101._id,
    voter: residentUser._id,
    choice: VoteChoice.FOR,
    weight: 120,
    votedAt: new Date(),
  });

  // 11. Documents
  console.log("📁 Ajout de documents types...");
  await ResidenceDocument.create({
    residence: residence1._id,
    uploadedBy: syndicUser._id,
    title: "Règlement intérieur de la copropriété",
    type: DocumentType.RULES,
    fileUrl: "/docs/reglement-interieur.pdf",
    uploadedAt: new Date("2024-01-01"),
  });

  await ResidenceDocument.create({
    residence: residence1._id,
    meeting: meeting._id,
    uploadedBy: syndicUser._id,
    title: "Convocation et Ordre du jour AG 2026",
    type: DocumentType.MINUTES,
    fileUrl: "/docs/convocation-ag-2026.pdf",
    uploadedAt: new Date("2026-02-01"),
  });

  console.log("\n==================================================");
  console.log("🎉 Données de démonstration injectées avec succès !");
  console.log("==================================================");
  console.log("Vous pouvez tester l'application avec :");
  console.log("  - ADMIN      : admin@syndicpro.tn    / Admin123!");
  console.log("  - SYNDIC     : syndic@syndicpro.tn   / Syndic123!");
  console.log("  - TECHNICIAN : tech@syndicpro.tn     / Tech123!");
  console.log("  - OWNER      : resident@syndicpro.tn / Resident123!");
  console.log("==================================================\n");

  process.exit(0);
}

runDemoSeed().catch((err) => {
  console.error("❌ Erreur pendant l'injection des données :", err);
  process.exit(1);
});

