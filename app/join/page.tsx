"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Send,
  Home,
  AlertCircle,
  Info,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ResidentType } from "@/types/enums";

interface ResidenceOption {
  _id: string;
  name: string;
  city: string;
  address: string;
}

interface JoinRequestItem {
  _id: string;
  residence: { _id: string; name: string; city: string; address?: string };
  apartmentNumber: string;
  residentType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  message?: string;
  rejectionReason?: string;
  createdAt: string;
}

export default function JoinPage() {
  const router = useRouter();
  const [residences, setResidences] = useState<ResidenceOption[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedResidence, setSelectedResidence] = useState("");
  const [apartmentNumber, setApartmentNumber] = useState("");
  const [residentType, setResidentType] = useState<ResidentType>(ResidentType.OWNER);
  const [message, setMessage] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resRes, reqRes] = await Promise.all([
        fetch("/api/residences/available").then((r) => r.json()),
        fetch("/api/join-requests").then((r) => r.json()),
      ]);

      if (resRes?.data) {
        setResidences(resRes.data);
        if (resRes.data.length > 0 && !selectedResidence) {
          setSelectedResidence(resRes.data[0]._id);
        }
      }

      if (reqRes?.data) {
        setMyRequests(reqRes.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResidence) {
      setError("Veuillez sélectionner une résidence");
      return;
    }
    if (!apartmentNumber.trim()) {
      setError("Veuillez indiquer votre numéro d'appartement ou lot");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residence: selectedResidence,
          apartmentNumber: apartmentNumber.trim(),
          residentType,
          message: message.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Impossible d'envoyer la demande");
      }

      setSuccess("Votre demande a été soumise avec succès au syndic de l'immeuble !");
      setApartmentNumber("");
      setMessage("");
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequest = myRequests.find((r) => r.status === "PENDING");

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Navigation retour */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
          <Link
            href="/dashboard"
            aria-label="Retour au tableau de bord"
            className="flex size-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center self-start rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-2xl font-bold text-slate-900 dark:text-white">
              Rattachement à une copropriété
            </h1>
            <p className="text-pretty text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              Associez votre compte utilisateur à votre appartement pour accéder aux services
            </p>
          </div>
        </div>

        {/* Message d'erreur global */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
        )}

        {/* Message de succès */}
        {success && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p>{success}</p>
          </div>
        )}

        {/* État : Demande en attente active */}
        {pendingRequest && (
          <Card className="border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                  <Clock className="size-6" aria-hidden />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-balance text-lg font-bold text-slate-900 dark:text-white">
                      Demande en cours d'examen
                    </h2>
                    <Badge variant="info">En attente de validation</Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Vous avez demandé à rejoindre la copropriété{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {pendingRequest.residence?.name}
                    </span>{" "}
                    pour le lot n°{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {pendingRequest.apartmentNumber}
                    </span>{" "}
                    en qualité de{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {pendingRequest.residentType === "OWNER" ? "Propriétaire" : "Locataire"}
                    </span>
                    .
                  </p>
                  <div className="flex items-center gap-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    <Info className="h-4 w-4 text-sky-500" />
                    <span>
                      Dès que le syndic aura validé votre demande, vos charges, annonces et assemblées générales s'afficheront automatiquement.
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulaire de demande (affiché s'il n'y a pas de demande pending) */}
        {!pendingRequest && (
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Formulaire de demande de rattachement
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Renseignez votre résidence et numéro de lot
                    </p>
                  </div>
                </div>

                {/* Sélection de la résidence */}
                <Select
                  label="Résidence / Immeuble *"
                  value={selectedResidence}
                  onChange={(e) => setSelectedResidence(e.target.value)}
                  options={residences.map((r) => ({
                    value: r._id,
                    label: `${r.name} (${r.city} - ${r.address})`,
                  }))}
                  helperText="Sélectionnez la résidence dans laquelle se situe votre logement"
                  required
                />

                {/* Numéro de lot ou appartement */}
                <Input
                  label="Numéro d'appartement ou lot *"
                  placeholder="Ex : A101, B12, Lot 4..."
                  value={apartmentNumber}
                  onChange={(e) => setApartmentNumber(e.target.value)}
                  helperText="Numéro visible sur votre bail ou acte de propriété"
                  required
                />

                {/* Qualité / Type d'occupant */}
                <Select
                  label="Vous êtes *"
                  value={residentType}
                  onChange={(e) => setResidentType(e.target.value as ResidentType)}
                  options={[
                    { value: ResidentType.OWNER, label: "Propriétaire (Copropriétaire)" },
                    { value: ResidentType.TENANT, label: "Locataire" },
                  ]}
                  helperText="Les propriétaires ont le droit de vote aux assemblées générales"
                />

                {/* Message optionnel */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="message"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Message ou précision pour le syndic (facultatif)
                  </label>
                  <textarea
                    id="message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ex : Bonjour, je viens d'emménager dans l'appartement A101 au 1er étage..."
                    className="min-h-[80px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>

                {/* Bouton de soumission */}
                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={submitting || loading || residences.length === 0}
                    className="gap-2 min-h-[44px] px-6 text-sm"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? "Envoi en cours..." : "Soumettre ma demande"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Historique des demandes passées */}
        {myRequests.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Historique de vos demandes
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myRequests.map((req) => (
                  <div key={req._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {req.residence?.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Lot {req.apartmentNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {req.residentType === "OWNER" ? "Propriétaire" : "Locataire"} — demandée le{" "}
                        {new Date(req.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                      {req.rejectionReason && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          Motif de refus : {req.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div>
                      {req.status === "PENDING" && <Badge variant="info">En attente</Badge>}
                      {req.status === "APPROVED" && <Badge variant="success">Approuvée</Badge>}
                      {req.status === "REJECTED" && <Badge variant="danger">Refusée</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

