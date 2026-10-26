"use client";

import React, { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { fetchWithOffline } from "@/lib/offline/apiClient";
import type { ResourceField, RelationConfig } from "@/lib/resources/types";

export interface ResourceFormProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  fields: ResourceField[];
  title: string;
  description?: string;
  initialData?: Partial<T> | null;
  loading?: boolean;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}

export function ResourceForm<T = any>({
  isOpen,
  onClose,
  fields,
  title,
  description,
  initialData,
  loading = false,
  onSubmit,
}: ResourceFormProps<T>) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [relationOptions, setRelationOptions] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});
  const [loadingRelations, setLoadingRelations] = useState(false);

  // Initialisation des valeurs du formulaire
  useEffect(() => {
    if (!isOpen) return;

    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (initialData && initialData[f.name as keyof T] !== undefined) {
        let val: any = initialData[f.name as keyof T];
        // Si le champ est un objet relation peuplé (ex: author: { _id, name }), on prend l'_id
        if (val && typeof val === "object" && "_id" in val) {
          val = val._id;
        }
        if (f.type === "date" && val) {
          try {
            val = new Date(val).toISOString().split("T")[0];
          } catch {
            // garder la valeur
          }
        }
        initial[f.name] = val;
      } else if (f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      } else if (f.type === "date") {
        initial[f.name] = new Date().toISOString().split("T")[0];
      } else if (f.type === "boolean") {
        initial[f.name] = false;
      } else {
        initial[f.name] = "";
      }

    });

    setValues(initial);
    setErrors({});
  }, [isOpen, fields, initialData]);

  // Chargement asynchrone des options pour les champs de type "relation"
  useEffect(() => {
    if (!isOpen) return;

    const relationFields = fields.filter((f) => f.type === "relation" && f.relation);
    if (relationFields.length === 0) return;

    let isMounted = true;
    async function loadRelations() {
      setLoadingRelations(true);
      const optionsMap: Record<string, Array<{ label: string; value: string }>> = {};

      await Promise.all(
        relationFields.map(async (field) => {
          const rel = field.relation as RelationConfig;
          const endpoint = rel.apiPath || `/api/${rel.resource}`;
          try {
            const res = await fetchWithOffline<any>(endpoint);
            const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            const valueKey = rel.valueField || "_id";

            optionsMap[field.name] = items.map((item: any) => ({
              label: String(item[rel.labelField] || item.name || item.title || item._id),
              value: String(item[valueKey] || item._id),
            }));
          } catch (err) {
            console.warn(`[ResourceForm] Erreur chargement relation ${field.name}:`, err);
            optionsMap[field.name] = [];
          }
        })
      );

      if (isMounted) {
        setRelationOptions(optionsMap);
        setLoadingRelations(false);
      }
    }

    loadRelations();

    return () => {
      isMounted = false;
    };
  }, [isOpen, fields]);

  const handleChange = (name: string, val: any) => {
    setValues((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((f) => {
      const val = values[f.name];
      if (f.required) {
        if (val === undefined || val === null || val === "") {
          newErrors[f.name] = `Le champ "${f.label}" est obligatoire`;
        }
      }
      if (f.type === "number" && val !== "" && val !== undefined) {
        if (isNaN(Number(val))) {
          newErrors[f.name] = `Veuillez saisir un nombre valide`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Nettoyage et typage avant soumission
    const cleaned: Record<string, any> = {};
    fields.forEach((f) => {
      const val = values[f.name];
      if (f.type === "number") {
        cleaned[f.name] = val === "" || val === undefined ? undefined : Number(val);
      } else if (f.type === "boolean") {
        cleaned[f.name] = Boolean(val);
      } else if (f.type === "date") {
        if (!val) {
          cleaned[f.name] = f.required ? "" : undefined;
        } else {
          cleaned[f.name] = new Date(val).toISOString();
        }
      } else if (f.type === "relation" || f.type === "select") {
        cleaned[f.name] = val === "" ? undefined : val;
      } else if (f.type === "text" || f.type === "textarea") {
        cleaned[f.name] = val === "" && !f.required ? undefined : val;
      } else {
        cleaned[f.name] = val;
      }
    });

    await onSubmit(cleaned);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2 pb-4">
        {fields.map((field) => {
          const errorMsg = errors[field.name];
          const val = values[field.name] ?? "";

          // 1. SELECT CLASSIQUE
          if (field.type === "select") {
            const rawOpts = (field.options || []).map((o) => ({
              label: o.label,
              value: String(o.value),
            }));
            const opts =
              !field.required && field.defaultValue === undefined
                ? [{ value: "", label: "— Aucun —" }, ...rawOpts]
                : rawOpts;
            return (
              <Select
                key={field.name}
                id={`field-${field.name}`}
                label={field.label}
                required={field.required}
                options={opts}
                value={String(val)}
                onChange={(e) => handleChange(field.name, e.target.value)}
                error={errorMsg}
                disabled={loading || field.readOnly}
              />
            );
          }

          // 2. RELATION DYNAMIQUE
          if (field.type === "relation") {
            const rawOpts = relationOptions[field.name] || [];
            const opts = [
              { value: "", label: field.required ? "— Sélectionner —" : "— Aucun —" },
              ...rawOpts,
            ];
            return (
              <div key={field.name} className="space-y-1">
                <Select
                  id={`field-${field.name}`}
                  label={field.label}
                  required={field.required}
                  options={opts}
                  value={String(val)}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  error={errorMsg}
                  disabled={loading || loadingRelations || field.readOnly}
                />
                {loadingRelations && (
                  <p className="text-[11px] text-slate-400">Chargement des options...</p>
                )}
              </div>
            );
          }

          // 3. TEXTAREA
          if (field.type === "textarea") {
            return (
              <div key={field.name} className="space-y-1.5">
                <label
                  htmlFor={`field-${field.name}`}
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  id={`field-${field.name}`}
                  rows={4}
                  value={String(val)}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={loading || field.readOnly}
                  className={`w-full rounded-2xl border bg-white p-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 sm:text-sm dark:bg-slate-900 dark:text-white ${
                    errorMsg
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-200 focus:border-sky-500 focus:ring-sky-500/20 dark:border-slate-800"
                  }`}
                />
                {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}
                {field.helpText && !errorMsg && (
                  <p className="text-[11px] text-slate-400">{field.helpText}</p>
                )}
              </div>
            );
          }

          // 4. BOOLEAN (SWITCH / CHECKBOX)
          if (field.type === "boolean") {
            return (
              <div
                key={field.name}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div>
                  <label
                    htmlFor={`field-${field.name}`}
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {field.label}
                  </label>
                  {field.helpText && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{field.helpText}</p>
                  )}
                </div>
                <input
                  type="checkbox"
                  id={`field-${field.name}`}
                  checked={Boolean(val)}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  disabled={loading || field.readOnly}
                  className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                />
              </div>
            );
          }

          // 5. INPUT STANDARD (text, number, date)
          return (
            <Input
              key={field.name}
              id={`field-${field.name}`}
              label={field.label}
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              value={val}
              onChange={(e) => handleChange(field.name, e.target.value)}
              error={errorMsg}
              disabled={loading || field.readOnly}
              helperText={field.helpText}
            />
          );
        })}

        {/* Boutons d'action tactiles */}
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Enregistrer
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
