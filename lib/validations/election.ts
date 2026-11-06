import { z } from "zod";
import { objectId, date } from "./common";

export const electionCreateSchema = z
  .object({
    residence: objectId,
    title: z.string().trim().min(3).default("Élection du nouveau syndic"),
    candidacyEndDate: date,
    votingEndDate: date,
  })
  .refine((d) => d.votingEndDate.getTime() > d.candidacyEndDate.getTime(), {
    message: "La fin des votes doit être postérieure à la fin des candidatures",
    path: ["votingEndDate"],
  });

export const electionCandidateSchema = z.object({
  statement: z.string().trim().max(500).optional(),
});

export const electionVoteSchema = z.object({
  candidate: objectId,
});

export type ElectionCreateInput = z.infer<typeof electionCreateSchema>;
export type ElectionCandidateInput = z.infer<typeof electionCandidateSchema>;
export type ElectionVoteInput = z.infer<typeof electionVoteSchema>;

