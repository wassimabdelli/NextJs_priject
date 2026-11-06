"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  Building2,
  Home,
  Mail,
  Phone,
  Calendar,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Save,
  Lock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Role } from "@/types/enums";

const roleLabels: Record<Role, { label: string; desc: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  [Role.ADMIN]: { label: "Administrateur Système", desc: "Supervision complète de l'application et de toutes les résidences", variant: "danger" },
  [Role.SYNDIC]: { label: "Syndic Gestionnaire", desc: "Administration des copropriétés, AG, finances et contrats", variant: "info" },
  [Role.OWNER]: { label: "Copropriétaire", desc: "Membre de l'assemblée générale avec droit de vote pondéré par tantièmes", variant: "success" },
  [Role.TENANT]: { label: "Locataire Occupant", desc: "Résident de la copropriété avec accès aux signalements, annonces et documents", variant: "success" },
  [Role.TECHNICIAN]: { label: "Technicien Référent", desc: "Interventions et maintenance technique sur les équipements", variant: "warning" },
};

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulaire Coordonnées
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Formulaire Sécurité
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/profile");
      if (!res.ok) {
        throw new Error("Impossible de charger les informations de votre profil");
      }
      const data = await res.json();
      const profile = data.data;
      setProfileData(profile);
      setName(profile.user?.name || "");
      setPhone(profile.user?.phone || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingContact(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de mise à jour");

      setSuccess("Vos coordonnées ont été enregistrées avec succès.");
      await loadProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingContact(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    try {
      setSavingPassword(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de mise à jour du mot de passe");

      setSuccess("Votre mot de passe a été modifié avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingPassword(false);
    }
  };

  const user = profileData?.user;
  const roleMeta = user ? roleLabels[user.role as Role] : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        {/* En-tête */}
        <div className="sp-page-header">
          <h1 className="sp-title text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Mon Compte & Profil
          </h1>
          <p className="sp-body text-sm text-slate-500 dark:text-slate-400">
            Consultez votre rattachement à la copropriété, vos lots et gérez vos accès.
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Carte d'identité principale */}
        {user && (
          <Card className="overflow-hidden dark:border-slate-800">
            <div className="bg-sky-600 p-6 text-white sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl font-bold text-white">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="size-10" aria-hidden />}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-balance text-2xl font-bold sm:text-3xl">
                      {user.name}
                    </h2>
                    {roleMeta && (
                      <span className="rounded-lg bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                        {roleMeta.label}
                      </span>
                    )}
                  </div>

                  <p className="max-w-xl text-pretty text-sm text-sky-100">
                    {roleMeta?.desc}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-sky-100">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                    </span>
                    {user.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {user.phone}
                      </span>
                    )}
                    {user.createdAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Inscrit le {new Date(user.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ======================================================== */}
        {/* RÉSIDENCES & LOGEMENTS (Section principale)               */}
        {/* ======================================================== */}
        {(user?.role === Role.OWNER || user?.role === Role.TENANT) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Mes Résidences & Lots
                </h3>
                <p className="text-xs text-slate-500">
                  Votre rattachement légal à la copropriété et la liste de vos appartements
                </p>
              </div>

              <Link href="/join">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs min-h-[44px]">
                  <Home className="h-3.5 w-3.5 text-sky-500" />
                  Rattacher un autre lot
                </Button>
              </Link>
            </div>

            {profileData?.residences?.length === 0 ? (
              <Card className="p-8 text-center space-y-3">
                <Building2 className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Aucun logement actuellement rattaché
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Vous n&apos;avez pas encore de lot validé dans une résidence. Faites une demande de rattachement auprès de votre syndic pour accéder à vos charges et votes.
                </p>
                <Link href="/join">
                  <Button variant="primary" className="mt-2 text-xs">
                    Faire une demande de rattachement
                  </Button>
                </Link>
              </Card>
            ) : (
              profileData?.residences?.map((res: any) => (
                <Card key={res.id} className="overflow-hidden border-slate-200 dark:border-slate-800">
                  {/* Bandeau de la résidence */}
                  <div className="border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-slate-900 dark:text-white">
                            {res.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {res.address}, {res.city}
                          </p>
                        </div>
                      </div>

                      {/* Contact du syndic */}
                      {res.syndic && (
                        <div className="rounded-xl border border-sky-200/80 bg-white p-3 text-xs shadow-sm dark:border-sky-900/50 dark:bg-slate-800 sm:max-w-xs">
                          <span className="block text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">
                            Syndic responsable
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {res.syndic.name}
                          </span>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            {res.syndic.phone && <span>📞 {res.syndic.phone}</span>}
                            <span>✉️ {res.syndic.email}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lots rattachés dans cette résidence */}
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Vos lots dans cette résidence ({res.lots?.length || 0})
                    </span>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {res.lots?.map((lot: any) => (
                        <div
                          key={lot.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 dark:border-slate-800 dark:bg-slate-900/40"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-sky-500" />
                              <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                                Appartement {lot.number}
                              </h5>
                            </div>
                            <Badge variant={lot.relationship.includes("Propriétaire") ? "success" : "info"}>
                              {lot.relationship}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center text-xs dark:border-slate-800">
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase">Étage</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {lot.floor === 0 ? "RDC" : `${lot.floor}ᵉ`}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase">Surface</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {lot.surface} m²
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase">Tantièmes</span>
                              <span className="font-bold text-sky-600 dark:text-sky-400">
                                {lot.shares} / 1000
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Section pour Syndic */}
        {user?.role === Role.SYNDIC && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-500" />
                Copropriétés sous votre mandat de gestion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profileData?.residences?.map((r: any) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-200 p-4 space-y-1 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</h4>
                    <p className="text-xs text-slate-500">{r.address}, {r.city}</p>
                    <span className="inline-block text-xs font-semibold text-sky-600 dark:text-sky-400 pt-1">
                      {r.totalApartments} lots sous gestion
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section pour Administrateur */}
        {user?.role === Role.ADMIN && (
          <Card className="border-rose-200 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/20">
            <CardContent className="p-5 flex items-center gap-4">
              <Shield className="h-8 w-8 text-rose-500 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Privilèges Administrateur Système
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {profileData?.details?.scope || "Accès global"}. Total sur la plateforme : {profileData?.details?.totalResidences || 0} résidences et {profileData?.details?.totalApartments || 0} lots enregistrés.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ======================================================== */}
        {/* FORMULAIRES DE GESTION DU COMPTE                          */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 1. Coordonnées de contact */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-sky-500" />
                Coordonnées de contact
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpdateContact} className="space-y-4">
                <Input
                  label="Nom & Prénom *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom complet"
                  required
                />

                <Input
                  label="Numéro de téléphone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : 20 123 456"
                />

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Adresse email (fixée)
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400">
                    L&apos;identifiant de connexion est géré par l&apos;administration.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingContact}
                  className="w-full gap-2 min-h-[44px] text-xs font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {savingContact ? "Enregistrement..." : "Mettre à jour mes coordonnées"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 2. Sécurité & Mot de passe */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-500" />
                Sécurité du compte
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <Input
                  label="Mot de passe actuel *"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />

                <Input
                  label="Nouveau mot de passe *"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  required
                />

                <Input
                  label="Confirmer le nouveau mot de passe *"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez à l'identique"
                  required
                />

                <Button
                  type="submit"
                  variant="outline"
                  disabled={savingPassword}
                  className="w-full gap-2 min-h-[44px] text-xs font-semibold"
                >
                  <KeyRound className="h-4 w-4" />
                  {savingPassword ? "Modification..." : "Modifier mon mot de passe"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

