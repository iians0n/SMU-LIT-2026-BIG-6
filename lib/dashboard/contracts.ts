import { z } from 'zod';

export const SourceRefSchema=z.object({kind:z.enum(['fact','excerpt']),id:z.string().min(1)});
export type SourceRef=z.infer<typeof SourceRefSchema>;
export interface Party{id:string;role:'claimant'|'respondent';type:'individual'|'business';name:string;address:string|null;location:'singapore'|'overseas'|'unknown';sourceRefs:SourceRef[]}
export interface Fact{id:string;key:string;label:string;value:string|number|boolean|null;origin:'user_stated'|'document_extracted'|'inferred';confirmedByUser:boolean;disputed:boolean;unknown:boolean;sourceLinks:SourceRef[];extractionConfidence:number|null}
export interface Excerpt{id:string;documentId:string;text:string;page:number;region?:string}
export interface Document{id:string;name:string;hash:string;processingStatus:'ready'|'processing'|'unreadable'|'password_protected'|'truncated'|'unsupported'|'possibly_unrelated';updatedAt:string;excerpts:Excerpt[]}
export interface Event{id:string;date:string|null;label:string;sourceRefs:SourceRef[]}
export interface IssueAssessment{id:string;title:string;checklistVersion:string;factIds:string[];supportingExcerptIds:string[];conflictingExcerptIds:string[];supportStatus:'supported'|'partial_or_disputed'|'missing'|'not_assessed';reason:string;nextQuestion:string;contraryExplanation:string}
export interface Contradiction{id:string;description:string;question:string;interpretations:string[];sourceRefs:SourceRef[];resolved:boolean}
export interface Case{id:string;ownerId:string;version:number;title:string;claimType:'goods'|'services'|'employment'|'tenancy'|'other'|'unknown';amountCents:number|null;causeOfActionDate:string|null;dateUncertain:boolean;consent:'both_confirmed'|'not_confirmed'|'declined';exceptionalCircumstances:'none'|'present'|'unknown';currentStage:number;parties:Party[];facts:Fact[];documents:Document[];events:Event[];issues:IssueAssessment[];contradictions:Contradiction[];unresolvedQuestions:string[]}
export type StageState='Not started'|'In progress'|'Needs review'|'Reviewed';
export interface Source{id:string;title:string;url:string;passage:string;retrievedAt:string;reviewedAt:string;version:string;available:boolean}
export interface GroundedAssertion{id:string;text:string;sourceId:string;passage:string}
export interface RouteScreening{sourceCaseVersion:number;rulesVersion:string;assessedAt:string;outcome:'appears_supported'|'more_information'|'outside_supported';reasons:{label:string;result:'pass'|'unknown'|'outside';assertionId?:string}[];reviewed:boolean}
export type Option='gather'|'settlement'|'help'|'file';
export interface Task{id:string;title:string;purpose:string;assertionId:string;requiredMaterial:string[];dependencies:string[];status:StageState;sourceCaseVersion:number}
export interface DraftField{id:string;section:'summary'|'chronology'|'evidence'|'amount'|'worksheet';label:string;value:string;required:boolean;sourceRef:SourceRef|null;additionalSourceRefs:SourceRef[];sourceCaseVersion:number;reviewedAt:string|null;aiDrafted:boolean}
export interface Draft{fields:DraftField[];renderedDraft:string;sourceCaseVersion:number;gaps:string[];gapsAcknowledged:boolean;warnings:string[];contradictionsAvailable:boolean}
export const VerificationInputSchema=z.object({action:z.enum(['generated','edited','reviewed','exported','case_updated','option_selected','gaps_acknowledged']),description:z.string().min(1).max(3000),sourceCaseVersion:z.number().int().positive(),sourceRefs:z.array(SourceRefSchema).max(100),fieldId:z.string().optional(),aiDrafted:z.boolean().default(false),before:z.string().max(20000).optional(),after:z.string().max(20000).optional()});
export type VerificationEvent=z.infer<typeof VerificationInputSchema>&{id:string;caseId:string;actorId:string;timestamp:string};
export const stale=(item:{sourceCaseVersion:number},record:Case)=>item.sourceCaseVersion!==record.version;
