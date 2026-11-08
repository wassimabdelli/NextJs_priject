import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Chargement automatique du .env.local si lancé directement via tsx
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
import { JoinRequest } from "../models/JoinRequest";
import { Election } from "../models/Election";
import { ElectionVote } from "../models/ElectionVote";

import {
  Role,
  ResidentType,
  ChargeStatus,
  PaymentMethod,
  PaymentValidationStatus,
  ExpenseCategory,
  IncidentCategory,
  Priority,
  IncidentStatus,
  IncidentTimelineType,
  MeetingStatus,
  VoteChoice,
  DocumentType,
  ElectionPhase,
} from "../types/enums";
import { JoinRequestStatus } from "../models/JoinRequest";
import { buildJitsiMeetUrl } from "../lib/meetings/meetLink";

async function runFullSeed() {
  console.log("🌱 Démarrage du seed enrichi SyndicPro (Toutes professions & Profils)...");
  await connectDB();

  // 1. Vidage complet de toutes les collections
  console.log("🧹 Vidage de toutes les collections...");
  const collections = await mongoose.connection.db!.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }

  // 2. Création des utilisateurs
  console.log("👤 Création des utilisateurs (Rôles & Métiers)...");
  const salt = bcrypt.genSaltSync(10);
  const commonTechPass = bcrypt.hashSync("Tech123!", salt);
  const commonProprioPass = bcrypt.hashSync("Resident123!", salt);
  const commonLocatairePass = bcrypt.hashSync("Locataire123!", salt);

  // Administration & Syndic
  const admin = await User.create({
    name: "Administrateur Système",
    email: "admin@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Admin123!", salt),
    phone: "20 000 001",
    role: Role.ADMIN,
    isActive: true,
  });

  const syndic = await User.create({
    name: "Mohamed Syndic",
    email: "syndic@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Syndic123!", salt),
    phone: "20 000 002",
    role: Role.SYNDIC,
    isActive: true,
  });

  // Techniciens par corps de métier (Professions)
  const techGeneral = await User.create({
    name: "Sami Technicien (Polyvalent)",
    email: "tech@syndicpro.tn",
    passwordHash: commonTechPass,
    phone: "20 000 003",
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: [
      IncidentCategory.PLUMBING,
      IncidentCategory.ELECTRICITY,
      IncidentCategory.OTHER,
    ],
  });

  const techPlombier = await User.create({
    name: "Walid Plombier",
    email: "tech.plomberie@syndicpro.tn",
    passwordHash: commonTechPass,
    phone: "21 100 200",
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: [IncidentCategory.PLUMBING],
  });

  const techElectricien = await User.create({
    name: "Khaled Électricien",
    email: "tech.electricite@syndicpro.tn",
    passwordHash: commonTechPass,
    phone: "22 300 400",
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: [IncidentCategory.ELECTRICITY],
  });

  const techAscenseur = await User.create({
    name: "Nizar Spécialiste Ascenseurs",
    email: "tech.ascenseur@syndicpro.tn",
    passwordHash: commonTechPass,
    phone: "23 500 600",
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: [IncidentCategory.ELEVATOR],
  });

  const techNettoyage = await User.create({
    name: "Faouzi Responsable Propreté",
    email: "tech.nettoyage@syndicpro.tn",
    passwordHash: commonTechPass,
    phone: "24 700 800",
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: [IncidentCategory.CLEANING],
  });

  const techSecurite = await User.create({
    name: "Béchir Agent de Sécurité",
    email: "tech.securite@syndicpro.tn",
    passwordHash: commonTechPass,
    phone: "25 900 100",
    role: Role.TECHNICIAN,
    isActive: true,
    technicianCategories: [IncidentCategory.SECURITY],
  });

  // Propriétaires (Copropriétaires)
  const owner = await User.create({
    name: "Yassine Propriétaire",
    email: "resident@syndicpro.tn",
    passwordHash: commonProprioPass,
    phone: "20 000 004",
    role: Role.OWNER,
    isActive: true,
  });

  const extraOwner = await User.create({
    name: "Ahmed Copropriétaire",
    email: "ahmed@syndicpro.tn",
    passwordHash: bcrypt.hashSync("Ahmed123!", salt),
    phone: "20 000 006",
    role: Role.OWNER,
    isActive: true,
  });

  const salmaOwner = await User.create({
    name: "Salma Mansour",
    email: "salma.proprio@syndicpro.tn",
    passwordHash: commonProprioPass,
    phone: "26 123 456",
    role: Role.OWNER,
    isActive: true,
  });

  const karimOwner = await User.create({
    name: "Karim Trabelsi",
    email: "karim.proprio@syndicpro.tn",
    passwordHash: commonProprioPass,
    phone: "27 789 012",
    role: Role.OWNER,
    isActive: true,
  });

  // Locataires
  const tenant = await User.create({
    name: "Amine Locataire",
    email: "locataire@syndicpro.tn",
    passwordHash: commonLocatairePass,
    phone: "20 000 005",
    role: Role.TENANT,
    isActive: true,
  });

  const nourTenant = await User.create({
    name: "Nour Jaziri",
    email: "nour.locataire@syndicpro.tn",
    passwordHash: commonLocatairePass,
    phone: "28 345 678",
    role: Role.TENANT,
    isActive: true,
  });

  const omarTenant = await User.create({
    name: "Omar Belhadj",
    email: "omar.locataire@syndicpro.tn",
    passwordHash: commonLocatairePass,
    phone: "29 901 234",
    role: Role.TENANT,
    isActive: true,
  });

  // 3. Création des 2 résidences
  console.log("🏢 Création des 2 résidences...");
  const residence1 = await Residence.create({
    name: "Résidence Les Jasmins",
    address: "15 Avenue Habib Bourguiba",
    city: "Tunis",
    floors: 5,
    totalApartments: 8,
    syndic: syndic._id,
  });

  const residence2 = await Residence.create({
    name: "Résidence Palm Beach",
    address: "Route Touristique",
    city: "La Marsa",
    floors: 3,
    totalApartments: 6,
    syndic: syndic._id,
  });

  // 4. Création des appartements
  console.log("🚪 Création des appartements...");
  // Lots Résidence 1
  const apt101 = await Apartment.create({
    residence: residence1._id,
    number: "A101",
    floor: 1,
    surface: 95,
    shares: 120,
    isOccupied: true,
    owner: owner._id,
  });

  const apt102 = await Apartment.create({
    residence: residence1._id,
    number: "A102",
    floor: 1,
    surface: 75,
    shares: 90,
    isOccupied: true,
    owner: extraOwner._id,
  });

  const apt201 = await Apartment.create({
    residence: residence1._id,
    number: "A201",
    floor: 2,
    surface: 110,
    shares: 140,
    isOccupied: true,
    owner: salmaOwner._id,
  });

  const apt202 = await Apartment.create({
    residence: residence1._id,
    number: "A202",
    floor: 2,
    surface: 80,
    shares: 100,
    isOccupied: true,
    owner: extraOwner._id,
  });

  // Lots Résidence 2
  const aptB1 = await Apartment.create({
    residence: residence2._id,
    number: "B01",
    floor: 0,
    surface: 120,
    shares: 150,
    isOccupied: true,
    owner: owner._id,
  });

  const aptB2 = await Apartment.create({
    residence: residence2._id,
    number: "B02",
    floor: 1,
    surface: 85,
    shares: 100,
    isOccupied: true,
    owner: karimOwner._id,
  });

  const aptB3 = await Apartment.create({
    residence: residence2._id,
    number: "B03",
    floor: 2,
    surface: 90,
    shares: 110,
    isOccupied: false,
  });

  // 5. Fiches Résidents
  console.log("👥 Création des fiches résidents...");
  await Resident.create({
    apartment: apt101._id,
    user: owner._id,
    fullName: owner.name,
    email: owner.email,
    phone: owner.phone,
    type: ResidentType.OWNER,
    moveInDate: new Date("2024-01-15"),
    isActive: true,
  });

  await Resident.create({
    apartment: apt102._id,
    user: tenant._id,
    fullName: tenant.name,
    email: tenant.email,
    phone: tenant.phone,
    type: ResidentType.TENANT,
    moveInDate: new Date("2024-06-01"),
    isActive: true,
  });

  await Resident.create({
    apartment: apt201._id,
    user: salmaOwner._id,
    fullName: salmaOwner.name,
    email: salmaOwner.email,
    phone: salmaOwner.phone,
    type: ResidentType.OWNER,
    moveInDate: new Date("2024-02-01"),
    isActive: true,
  });

  await Resident.create({
    apartment: apt202._id,
    user: nourTenant._id,
    fullName: nourTenant.name,
    email: nourTenant.email,
    phone: nourTenant.phone,
    type: ResidentType.TENANT,
    moveInDate: new Date("2024-08-01"),
    isActive: true,
  });

  await Resident.create({
    apartment: aptB1._id,
    user: omarTenant._id,
    fullName: omarTenant.name,
    email: omarTenant.email,
    phone: omarTenant.phone,
    type: ResidentType.TENANT,
    moveInDate: new Date("2024-03-01"),
    isActive: true,
  });

  await Resident.create({
    apartment: aptB2._id,
    user: karimOwner._id,
    fullName: karimOwner.name,
    email: karimOwner.email,
    phone: karimOwner.phone,
    type: ResidentType.OWNER,
    moveInDate: new Date("2023-11-01"),
    isActive: true,
  });

  // 6. Charges
  console.log("💰 Création des charges...");
  const chargePaid = await Charge.create({
    apartment: apt101._id,
    period: "2026-01",
    amount: 150,
    paidAmount: 150,
    dueDate: new Date("2026-01-20"),
    status: ChargeStatus.PAID,
  });

  const chargePending = await Charge.create({
    apartment: apt101._id,
    period: "2026-02",
    amount: 150,
    paidAmount: 0,
    dueDate: new Date("2026-02-28"),
    status: ChargeStatus.PENDING,
  });

  const chargePartial = await Charge.create({
    apartment: apt102._id,
    period: "2026-01",
    amount: 120,
    paidAmount: 50,
    dueDate: new Date("2026-01-25"),
    status: ChargeStatus.PARTIAL,
  });

  const chargeOverdue = await Charge.create({
    apartment: apt201._id,
    period: "2025-12",
    amount: 140,
    paidAmount: 0,
    dueDate: new Date("2025-12-20"),
    status: ChargeStatus.OVERDUE,
  });

  // 7. Règlements
  console.log("💳 Création des règlements...");
  await Payment.create({
    charge: chargePaid._id,
    receivedBy: syndic._id,
    amount: 150,
    paymentDate: new Date("2026-01-14"),
    method: PaymentMethod.BANK_TRANSFER,
    receiptNumber: "REC-20260114-001",
    validationStatus: PaymentValidationStatus.VALIDATED,
    validatedBy: syndic._id,
    validatedAt: new Date("2026-01-14"),
  });

  await Payment.create({
    charge: chargePartial._id,
    receivedBy: syndic._id,
    amount: 50,
    paymentDate: new Date("2026-01-20"),
    method: PaymentMethod.CASH,
    receiptNumber: "REC-20260120-002",
    validationStatus: PaymentValidationStatus.VALIDATED,
    validatedBy: syndic._id,
    validatedAt: new Date("2026-01-20"),
  });

  await Payment.create({
    charge: chargePaid._id,
    receivedBy: syndic._id,
    amount: 75,
    paymentDate: new Date("2026-01-08"),
    method: PaymentMethod.CARD,
    receiptNumber: "REC-20260108-003",
    validationStatus: PaymentValidationStatus.VALIDATED,
    validatedBy: syndic._id,
    validatedAt: new Date("2026-01-08"),
  });

  // Preuve Flip en attente de validation syndic (démo portefeuille)
  await Payment.create({
    charge: chargePartial._id,
    submittedBy: extraOwner._id,
    amount: 70,
    paymentDate: new Date("2026-02-05"),
    method: PaymentMethod.FLIP,
    receiptNumber: "REC-20260205-PEND",
    proofUrl: "https://example.com/proofs/flip-ahmed-2026-01.png",
    validationStatus: PaymentValidationStatus.PENDING_VALIDATION,
  });

  // 8. Dépenses par catégorie
  console.log("🧾 Création des dépenses...");
  const categories = [
    { cat: ExpenseCategory.WATER, amount: 95, desc: "Facture SONEDE espaces verts" },
    { cat: ExpenseCategory.ELECTRICITY, amount: 180, desc: "Facture STEG éclairage commun" },
    { cat: ExpenseCategory.ELEVATOR, amount: 350, desc: "Maintenance trimestrielle ascenseur OTIS" },
    { cat: ExpenseCategory.CLEANING, amount: 210, desc: "Prestation nettoyage Janvier" },
    { cat: ExpenseCategory.SECURITY, amount: 400, desc: "Gardiennage nocturne et télésurveillance" },
    { cat: ExpenseCategory.MAINTENANCE, amount: 130, desc: "Remplacement serrures porte d'accès" },
    { cat: ExpenseCategory.OTHER, amount: 60, desc: "Frais bancaires tenue de compte syndic" },
  ];

  for (const c of categories) {
    await Expense.create({
      residence: residence1._id,
      category: c.cat,
      description: c.desc,
      amount: c.amount,
      expenseDate: new Date("2026-01-15"),
    });
  }

  // 9. Incidents assignés à chaque technicien spécialisé
  console.log("⚠️ Création des incidents et assignation par métier...");
  const mkTimeline = (
    reportedBy: { _id: unknown },
    assignedTo: { _id: unknown } | null,
    reportedAt: Date,
    status: IncidentStatus
  ) => {
    const events = [
      {
        at: reportedAt,
        by: reportedBy._id,
        type: IncidentTimelineType.CREATED,
        message: "Incident signalé",
      },
    ];
    if (assignedTo) {
      events.push({
        at: new Date(reportedAt.getTime() + 3600_000),
        by: syndic._id,
        type: IncidentTimelineType.ASSIGNED,
        message: "Technicien assigné",
      });
    }
    if (status === IncidentStatus.IN_PROGRESS || status === IncidentStatus.RESOLVED) {
      events.push({
        at: new Date(reportedAt.getTime() + 7200_000),
        by: assignedTo?._id || syndic._id,
        type: IncidentTimelineType.STATUS,
        message: `Statut : ${status}`,
      });
    }
    return events;
  };

  // Plomberie -> Walid Plombier
  await Incident.create({
    residence: residence1._id,
    apartment: apt101._id,
    reportedBy: owner._id,
    assignedTo: techPlombier._id,
    title: "Fuite d'eau au niveau de la colonne générale sous-sol",
    description: "Une conduite d'eau présente un goutte-à-goutte constant au parking place n°3.",
    category: IncidentCategory.PLUMBING,
    priority: Priority.HIGH,
    status: IncidentStatus.IN_PROGRESS,
    reportedAt: new Date("2026-01-30"),
    timeline: mkTimeline(owner, techPlombier, new Date("2026-01-30"), IncidentStatus.IN_PROGRESS),
  });

  // Électricité -> Khaled Électricien
  await Incident.create({
    residence: residence2._id,
    apartment: aptB1._id,
    reportedBy: omarTenant._id,
    assignedTo: techElectricien._id,
    title: "Panne de l'éclairage de sécurité du couloir principal",
    description: "Les blocs autonomes clignotent en rouge et le disjoncteur a sauté.",
    category: IncidentCategory.ELECTRICITY,
    priority: Priority.MEDIUM,
    status: IncidentStatus.ASSIGNED,
    reportedAt: new Date("2026-02-01"),
    timeline: mkTimeline(omarTenant, techElectricien, new Date("2026-02-01"), IncidentStatus.ASSIGNED),
  });

  // Ascenseur -> Nizar Spécialiste Ascenseurs
  await Incident.create({
    residence: residence1._id,
    reportedBy: syndic._id,
    assignedTo: techAscenseur._id,
    title: "Bruit anormal lors de la descente de l'ascenseur",
    description: "Frottement métallique perceptible entre le 1er étage et le rez-de-chaussée.",
    category: IncidentCategory.ELEVATOR,
    priority: Priority.URGENT,
    status: IncidentStatus.RESOLVED,
    reportedAt: new Date("2026-01-20"),
    resolvedAt: new Date("2026-01-21"),
    timeline: mkTimeline(syndic, techAscenseur, new Date("2026-01-20"), IncidentStatus.RESOLVED),
  });

  // Nettoyage -> Faouzi Responsable Nettoyage
  await Incident.create({
    residence: residence1._id,
    apartment: apt202._id,
    reportedBy: nourTenant._id,
    assignedTo: techNettoyage._id,
    title: "Dépôt d'encombrants devant le local à poubelles",
    description: "Des gravats et cartons volumineux empêchent l'accès aux bacs collectifs.",
    category: IncidentCategory.CLEANING,
    priority: Priority.LOW,
    status: IncidentStatus.ASSIGNED,
    reportedAt: new Date("2026-02-02"),
    timeline: mkTimeline(nourTenant, techNettoyage, new Date("2026-02-02"), IncidentStatus.ASSIGNED),
  });

  // Sécurité -> Béchir Sécurité
  await Incident.create({
    residence: residence1._id,
    reportedBy: extraOwner._id,
    assignedTo: techSecurite._id,
    title: "Porte automatique du garage restant ouverte",
    description: "Le capteur optique de sécurité est désaxé, la porte ne se referme plus automatiquement.",
    category: IncidentCategory.SECURITY,
    priority: Priority.HIGH,
    status: IncidentStatus.IN_PROGRESS,
    reportedAt: new Date("2026-02-01"),
    timeline: mkTimeline(extraOwner, techSecurite, new Date("2026-02-01"), IncidentStatus.IN_PROGRESS),
  });

  // Polyvalent -> Sami Technicien
  await Incident.create({
    residence: residence1._id,
    apartment: apt102._id,
    reportedBy: tenant._id,
    assignedTo: techGeneral._id,
    title: "Gond de la boîte aux lettres fracturé",
    description: "La porte de la boîte n°A102 ne ferme plus à clé.",
    category: IncidentCategory.OTHER,
    priority: Priority.LOW,
    status: IncidentStatus.REPORTED,
    reportedAt: new Date("2026-02-02"),
    timeline: mkTimeline(tenant, techGeneral, new Date("2026-02-02"), IncidentStatus.REPORTED),
  });

  // 10. Annonces
  console.log("📢 Création des annonces...");
  await Announcement.create({
    residence: residence1._id,
    author: syndic._id,
    title: "Nettoyage annuel haute pression des parkings",
    content: "Le nettoyage aura lieu ce samedi matin. Merci de libérer les places en sous-sol.",
    publishedAt: new Date(),
    isPinned: true,
  });

  await Announcement.create({
    residence: residence1._id,
    author: syndic._id,
    title: "Consignes de tri sélectif et encombrants",
    content: "Rappel à tous les occupants : les gros cartons doivent être déposés pliés dans la benne prévue.",
    publishedAt: new Date("2026-01-28"),
    isPinned: false,
  });

  // 11. AG & Résolutions & Votes
  console.log("🗳️ Assemblée Générale et résolutions...");
  const meeting = await Meeting.create({
    residence: residence1._id,
    title: "Assemblée Générale Ordinaire 2026",
    date: new Date("2026-03-20T18:00:00.000Z"),
    location: "Hall d'entrée & Visioconférence",
    agenda: "1. Bilan financier 2025\n2. Budget prévisionnel 2026\n3. Rénovation de la porte du garage",
    status: MeetingStatus.OPEN,
  });
  meeting.meetUrl = buildJitsiMeetUrl(String(meeting._id), meeting.title);
  meeting.meetProvider = "jitsi";
  meeting.meetCreatedAt = new Date();
  await meeting.save();

  const res1 = await Resolution.create({
    meeting: meeting._id,
    title: "Résolution n°1 : Approbation des comptes de gestion 2025",
    description: "Quitus de gestion accordé au syndic pour l'exercice clos.",
    requiredMajority: 50,
  });

  const res2 = await Resolution.create({
    meeting: meeting._id,
    title: "Résolution n°2 : Installation de caméras de surveillance",
    description: "Pose de 4 caméras HD connectées pour un montant maximum de 2 500 TND.",
    requiredMajority: 66,
  });

  await Vote.create({
    resolution: res1._id,
    apartment: apt101._id,
    voter: owner._id,
    choice: VoteChoice.FOR,
    weight: 120,
    votedAt: new Date(),
  });

  await Vote.create({
    resolution: res1._id,
    apartment: apt201._id,
    voter: salmaOwner._id,
    choice: VoteChoice.FOR,
    weight: 140,
    votedAt: new Date(),
  });

  await Vote.create({
    resolution: res2._id,
    apartment: apt102._id,
    voter: extraOwner._id,
    choice: VoteChoice.AGAINST,
    weight: 90,
    votedAt: new Date(),
  });

  // 12. Documents
  console.log("📁 Documents de copropriété...");
  const docs = [
    { title: "Règlement intérieur copropriété", type: DocumentType.RULES, url: "/docs/reglement.pdf" },
    { title: "Procès-Verbal AG 2025", type: DocumentType.MINUTES, url: "/docs/pv-ag-2025.pdf" },
    { title: "Contrat de maintenance ascenseur OTIS", type: DocumentType.CONTRACT, url: "/docs/contrat-otis.pdf" },
    { title: "Facture STEG Parties Communes", type: DocumentType.INVOICE, url: "/docs/facture-steg.pdf" },
    { title: "Police d'assurance multirisque immeuble", type: DocumentType.OTHER, url: "/docs/assurance.pdf" },
  ];

  for (const d of docs) {
    await ResidenceDocument.create({
      residence: residence1._id,
      uploadedBy: syndic._id,
      title: d.title,
      type: d.type,
      fileUrl: d.url,
      uploadedAt: new Date(),
    });
  }

  // 13. Demandes de rattachement
  console.log("📋 Demandes de rattachement...");
  await JoinRequest.create({
    user: owner._id,
    residence: residence1._id,
    apartmentNumber: "A101",
    requestedRole: Role.OWNER,
    residentType: ResidentType.OWNER,
    status: JoinRequestStatus.APPROVED,
    reviewedBy: syndic._id,
    reviewedAt: new Date("2026-01-15"),
  });

  await JoinRequest.create({
    user: tenant._id,
    residence: residence1._id,
    apartmentNumber: "A102",
    requestedRole: Role.TENANT,
    residentType: ResidentType.TENANT,
    status: JoinRequestStatus.APPROVED,
    reviewedBy: syndic._id,
    reviewedAt: new Date("2026-01-16"),
  });

  await JoinRequest.create({
    user: salmaOwner._id,
    residence: residence1._id,
    apartmentNumber: "A201",
    requestedRole: Role.OWNER,
    residentType: ResidentType.OWNER,
    status: JoinRequestStatus.APPROVED,
    reviewedBy: syndic._id,
    reviewedAt: new Date("2026-01-20"),
  });

  await JoinRequest.create({
    user: karimOwner._id,
    residence: residence2._id,
    apartmentNumber: "B03",
    requestedRole: Role.OWNER,
    residentType: ResidentType.OWNER,
    status: JoinRequestStatus.PENDING,
    message: "Bonjour, je viens d'acheter le lot B03 au 2ème étage.",
  });

  // 14. Élections de Syndic
  console.log("🗳️ Élections de syndic...");
  const now = new Date();
  const candidacyEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const votingEnd = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  await Election.create({
    residence: residence1._id,
    title: "Élection du syndic 2026-2027",
    createdBy: admin._id,
    phase: ElectionPhase.CANDIDACY,
    candidacyEndDate: candidacyEnd,
    votingEndDate: votingEnd,
    candidates: [
      {
        user: owner._id,
        name: owner.name,
        email: owner.email,
        statement: "Engagé pour moderniser les équipements et optimiser les charges.",
        registeredAt: new Date(),
      },
      {
        user: salmaOwner._id,
        name: salmaOwner.name,
        email: salmaOwner.email,
        statement: "Rigueur comptable et suivi hebdomadaire des prestataires.",
        registeredAt: new Date(),
      },
      {
        user: extraOwner._id,
        name: extraOwner.name,
        email: extraOwner.email,
        statement: "Expérience associative et gestion transparente.",
        registeredAt: new Date(),
      },
    ],
    announcements: {
      candidacyAnnounced: true,
      votingAnnounced: false,
      resultsAnnounced: false,
    },
  });

  // Élection 2 (Résidence Palm Beach) : Terminée avec gagnant
  const pastElection = await Election.create({
    residence: residence2._id,
    title: "Élection du syndic 2025",
    createdBy: admin._id,
    phase: ElectionPhase.COMPLETED,
    candidacyEndDate: new Date("2025-11-10"),
    votingEndDate: new Date("2025-11-20"),
    candidates: [
      {
        user: syndic._id,
        name: syndic.name,
        email: syndic.email,
        statement: "Gestion transparente et réactivité garantie.",
        registeredAt: new Date("2025-11-05"),
      },
    ],
    winner: {
      user: syndic._id,
      name: syndic.name,
      votesCount: 3,
      votesWeight: 350,
    },
    announcements: {
      candidacyAnnounced: true,
      votingAnnounced: true,
      resultsAnnounced: true,
    },
  });

  await ElectionVote.create({
    election: pastElection._id,
    voter: owner._id,
    candidate: syndic._id,
    weight: 150,
    votedAt: new Date("2025-11-15"),
  });

  // Garde-fou démo : Mohamed reste syndic des 2 résidences, Yassine reste OWNER
  // (une élection COMPLETED seedée ne doit pas casser les comptes de test).
  await Residence.updateMany({}, { syndic: syndic._id });
  await User.updateOne({ _id: owner._id }, { role: Role.OWNER });
  await User.updateOne({ _id: syndic._id }, { role: Role.SYNDIC });

  console.log("\n==================================================");
  console.log("🎉 SEED ENRICHI TERMINÉ AVEC SUCCÈS !");
  console.log("==================================================");
  console.log("Comptes créés par profil :");
  console.log("  • ADMIN       : admin@syndicpro.tn         (Admin123!)");
  console.log("  • SYNDIC      : syndic@syndicpro.tn        (Syndic123!)");
  console.log("  • TECHNICIENS :");
  console.log("      - Polyvalent : tech@syndicpro.tn       (Tech123!)");
  console.log("      - Plombier   : tech.plomberie@syndicpro.tn");
  console.log("      - Électricien: tech.electricite@syndicpro.tn");
  console.log("      - Ascenseurs : tech.ascenseur@syndicpro.tn");
  console.log("      - Nettoyage  : tech.nettoyage@syndicpro.tn");
  console.log("      - Sécurité   : tech.securite@syndicpro.tn");
  console.log("  • PROPRIÉTAIRES :");
  console.log("      - Yassine    : resident@syndicpro.tn   (Resident123!)");
  console.log("      - Ahmed      : ahmed@syndicpro.tn      (Ahmed123!)");
  console.log("      - Salma      : salma.proprio@syndicpro.tn");
  console.log("      - Karim      : karim.proprio@syndicpro.tn");
  console.log("  • LOCATAIRES :");
  console.log("      - Amine      : locataire@syndicpro.tn  (Locataire123!)");
  console.log("      - Nour       : nour.locataire@syndicpro.tn");
  console.log("      - Omar       : omar.locataire@syndicpro.tn");
  console.log("==================================================\n");

  process.exit(0);
}

runFullSeed().catch((err) => {
  console.error("❌ Erreur pendant le seed :", err);
  process.exit(1);
});
