import { z } from 'zod';
export const SourceRefSchema = z.object({ kind:z.enum(['fact','excerpt']), id:z.string().min(1) });
export type SourceRef = z.infer<typeof SourceRefSchema>;
export const PartySchema = z.object({ id:z.string(), role:z.enum(['claimant','respondent']), type:z.enum(['individual','business']), name:z.string(), address:z.string().nullable(), location:z.enum(['singapore','overseas','unknown']), sourceRefs:z.array(SourceRefSchema) });
export const FactSchema = z.object({ id:z.string(), key:z.string(), label:z.string(), value:z.union([z.string(),z.number(),z.boolean(),z.null()]), origin:z.enum(['user_stated','document_extracted','inferred']), confirmedByUser:z.boolean(), disputed:z.boolean(), unknown:z.boolean(), sourceLinks:z.array(SourceRefSchema), extractionConfidence:z.number().min(0).max(1).nullable() });
export const ExcerptSchema = z.object({ id:z.string(), documentId:z.string(), text:z.string(), page:z.number().int().positive(), region:z.string().optional() });
export const DocumentSchema = z.object({ id:z.string(), name:z.string(), hash:z.string(), processingStatus:z.enum(['ready','processing','unreadable','password_protected','truncated','unsupported','possibly_unrelated']), updatedAt:z.string(), excerpts:z.array(ExcerptSchema) });
export const EventSchema = z.object({ id:z.string(), date:z.string().nullable(), label:z.string(), sourceRefs:z.array(SourceRefSchema) });
export const IssueSchema = z.object({ id:z.string(), title:z.string(), checklistVersion:z.string(), factIds:z.array(z.string()), supportingExcerptIds:z.array(z.string()), conflictingExcerptIds:z.array(z.string()), supportStatus:z.enum(['supported','partial_or_disputed','missing','not_assessed']), reason:z.string(), nextQuestion:z.string(), contraryExplanation:z.string() });
export const ContradictionSchema = z.object({ id:z.string(), description:z.string(), question:z.string(), interpretations:z.array(z.string()), sourceRefs:z.array(SourceRefSchema), resolved:z.boolean() });
export const CaseSchema = z.object({ id:z.string(), ownerId:z.string(), version:z.number().int().positive(), title:z.string(), claimType:z.enum(['goods','services','employment','tenancy','other','unknown']), amountCents:z.number().int().nonnegative().nullable(), causeOfActionDate:z.string().nullable(), dateUncertain:z.boolean(), consent:z.enum(['both_confirmed','not_confirmed','declined']), exceptionalCircumstances:z.enum(['none','present','unknown']), currentStage:z.number().min(1).max(6), parties:z.array(PartySchema), facts:z.array(FactSchema), documents:z.array(DocumentSchema), events:z.array(EventSchema), issues:z.array(IssueSchema), contradictions:z.array(ContradictionSchema), unresolvedQuestions:z.array(z.string()) });
export type Case = z.infer<typeof CaseSchema>;
export type Party = z.infer<typeof PartySchema>;
export type Fact = z.infer<typeof FactSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Excerpt = z.infer<typeof ExcerptSchema>;
export type Event = z.infer<typeof EventSchema>;
export type IssueAssessment = z.infer<typeof IssueSchema>;
export type Contradiction = z.infer<typeof ContradictionSchema>;
export type StageState = 'Not started' | 'In progress' | 'Needs review' | 'Reviewed';
export interface Source { id:string; title:string; url:string; passage:string; retrievedAt:string; reviewedAt:string; version:string; available:boolean; }
export interface GroundedAssertion { id:string; text:string; sourceId:string; passage:string; }
export interface RouteScreening { sourceCaseVersion:number; rulesVersion:string; assessedAt:string; outcome:'appears_supported'|'more_information'|'outside_supported'; reasons: { label:string; result:'pass'|'unknown'|'outside'; assertionId?:string }[]; reviewed:boolean; }
export type Option = 'gather'|'settlement'|'help'|'file';
export interface Task { id:string; title:string; purpose:string; assertionId:string; requiredMaterial:string[]; dependencies:string[]; status:StageState; sourceCaseVersion:number; }
export interface DraftField { id:string; section:'summary'|'chronology'|'evidence'|'amount'|'worksheet'; label:string; value:string; required:boolean; sourceRef:SourceRef|null; additionalSourceRefs:SourceRef[]; sourceCaseVersion:number; reviewedAt:string|null; aiDrafted:boolean; }
export interface Draft { fields:DraftField[]; renderedDraft:string; sourceCaseVersion:number; gaps:string[]; gapsAcknowledged:boolean; warnings:string[]; contradictionsAvailable:boolean; }
export const VerificationInputSchema = z.object({ action:z.enum(['generated','edited','reviewed','exported','case_updated','option_selected','gaps_acknowledged']), description:z.string().min(1).max(3000), sourceCaseVersion:z.number().int().positive(), sourceRefs:z.array(SourceRefSchema).max(100), fieldId:z.string().optional(), aiDrafted:z.boolean().default(false), before:z.string().max(20000).optional(), after:z.string().max(20000).optional() });
export type VerificationEvent = z.infer<typeof VerificationInputSchema> & { id:string; caseId:string; actorId:string; timestamp:string };
export const stale = (item:{sourceCaseVersion:number},record:Case) => item.sourceCaseVersion !== record.version;
