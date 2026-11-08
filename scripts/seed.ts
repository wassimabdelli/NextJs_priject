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
import { Role } from "../types/enums";

async function runSeed() {
  console.log("🌱 Démarrage du seed SyndicPro (Reset minimal)...");
  await connectDB();

  // 1. Vidage de TOUTES les collections de la base
  console.log("🧹 Vidage complet de toutes les collections...");
  const collections = await mongoose.connection.db!.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }

  // 2. Création des 4 comptes utilisateurs avec mots de passe hashés (10 rounds bcrypt)
  console.log("👤 Création des 4 rôles utilisateurs...");
  const salt = bcrypt.genSaltSync(10);
  const adminPassword = bcrypt.hashSync("Admin123!", salt);
  const syndicPassword = bcrypt.hashSync("Syndic123!", salt);
  const techPassword = bcrypt.hashSync("Tech123!", salt);
  const residentPassword = bcrypt.hashSync("Resident123!", salt);

  await User.create({
    name: "Administrateur Système",
    email: "admin@syndicpro.tn",
    passwordHash: adminPassword,
    phone: "20 000 001",
    role: Role.ADMIN,
    isActive: true,
  });

  await User.create({
    name: "Mohamed Syndic",
    email: "syndic@syndicpro.tn",
    passwordHash: syndicPassword,
    phone: "20 000 002",
    role: Role.SYNDIC,
    isActive: true,
  });

  await User.create({
    name: "Sami Technicien",
    email: "tech@syndicpro.tn",
    passwordHash: techPassword,
    phone: "20 000 003",
    role: Role.TECHNICIAN,
    isActive: true,
  });

  await User.create({
    name: "Yassine Résident",
    email: "resident@syndicpro.tn",
    passwordHash: residentPassword,
    phone: "20 000 004",
    role: Role.RESIDENT,
    isActive: true,
  });

  console.log("\n==================================================");
  console.log("✅ Seed terminé avec succès !");
  console.log("--------------------------------------------------");
  console.log("Comptes de test configurés :");
  console.log("  ADMIN      : admin@syndicpro.tn    / Admin123!");
  console.log("  SYNDIC     : syndic@syndicpro.tn   / Syndic123!");
  console.log("  TECHNICIAN : tech@syndicpro.tn     / Tech123!");
  console.log("  RESIDENT   : resident@syndicpro.tn / Resident123!");
  console.log("ℹ️ Base vide : créez la résidence, les appartements, etc. depuis l'application.");
  console.log("==================================================\n");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Erreur pendant le seed :", err);
  process.exit(1);
});

