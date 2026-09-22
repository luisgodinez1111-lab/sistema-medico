// EPIC R — Clinical Intelligence Deterministic Layer (EXEC-0021, EXEC-0022, EXEC-0025).
// Deterministic rules engine for clinical knowledge, safety alerts, care gaps, omissions.
// Separates: Patient State Engine, Clinical Reasoning Support, Omission Detection,
// Clinical Safety, Longitudinal Intelligence, Care Gap, Clinical Obligation, Knowledge & Evidence.
// Safety-critical deterministic logic separable from probabilistic AI output.
// AI Risk Tiers: Tier A (low), Tier B (doc assistance), Tier C (decision support), Tier D (autonomous - blocked).
// Autoridad: PROD (CDS determinístico), CAP-CLINICAL-INTEL-001.
import{ClinicalError}from"../../runtime-errors/src";

export type KnowledgePackage={
  id:string;version:string;specialty:string;effectiveDate:string;
  reviewers:{id:string;role:string}[];
  sources:{citation:string;url?:string}[];
  applicability:ApplicabilityRule[];
  questions:QuestionDefinition[];
  redFlags:RuleDefinition[];
  focusedExam:RuleDefinition[];
  differentialHints:RuleDefinition[];
  orderConsiderations:SuggestionRule[]; // sugerencias: sin severidad (el motor emite urgencia ROUTINE)
  followUpRules:SuggestionRule[];
  safetyNet:RuleDefinition[];
};
export type SuggestionRule=Omit<RuleDefinition,"severity">;

// Auditoría 2026-09-19 (L-13): las condiciones eran CADENAS evaluadas con `new Function(...)`. Aunque hoy los paquetes de
// conocimiento son constantes del código, una regla que llegara a registrarse por API sería ejecución remota de código.
// Ahora una condición es una FUNCIÓN TIPADA sobre un contexto cerrado (`RuleContext`): no existe evaluación dinámica de
// texto en ningún punto del motor. Un paquete que quiera venir de datos deberá traducirse a este contrato con un parser
// propio y acotado, nunca con eval.
export type RuleContext=Readonly<{
  age:number;sex:"M"|"F"|"O";chiefComplaint:string;
  recentVitals:readonly{type:string;value:number;timestamp:string}[];
  recentResults:readonly{code:string;value:number;unit:string;timestamp:string}[];
  hasProblem:(codePrefix:string)=>boolean;hasMedication:(codePrefix:string)=>boolean;hasAllergy:(substance:string)=>boolean;
}>;
export type RuleCondition=(c:RuleContext)=>boolean;

export type ApplicabilityRule={
  condition:RuleCondition;
  include:boolean;
};

export type QuestionDefinition={
  id:string;text:string;trigger:RuleCondition;
  expectedAnswers:string[];required:boolean;
};

export type RuleDefinition={
  id:string;condition:RuleCondition;action:string;severity:"INFO"|"CONSIDER"|"IMPORTANT"|"CRITICAL";
  evidence:string[];version:string;
};

export type PatientStateSummary={
  patientId:string;age:number;sex:"M"|"F"|"O";
  activeProblems:{code:string;status:string;onset:string}[];
  activeMedications:{code:string;dose:string;route:string;frequency:string}[];
  allergies:{substance:string;reaction:string;severity:string}[];
  recentVitals:{type:string;value:number;unit:string;timestamp:string}[];
  recentResults:{code:string;value:number;unit:string;status:string;timestamp:string}[];
  openObligations:{type:string;dueAt:string;priority:string}[];
};

export type IntelligenceOutput={
  questions:{id:string;text:string;reason:string}[];
  redFlags:{id:string;message:string;severity:"INFO"|"CONSIDER"|"IMPORTANT"|"CRITICAL";evidence:string[]}[];
  focusedExam:{id:string;instruction:string;reason:string}[];
  differentialHints:{condition:string;probability:number;evidence:string[]}[];
  orderConsiderations:{orderType:string;reason:string;urgency:"ROUTINE"|"URGENT"|"STAT"}[];
  followUpRules:{obligationType:string;dueAt:string;reason:string;priority:"ROUTINE"|"URGENT"|"CRITICAL"}[];
  safetyNet:{message:string;action:string}[];
  careGaps:{gapType:string;description:string;dueAt:string;priority:string}[];
  longitudinalInsights:{trend:string;significance:string;action:string}[];
};

// Knowledge Package Registry (in-memory for demo; production uses DB)
const KNOWLEDGE_REGISTRY:Map<string,any>=new Map();

// Deterministic Rules Engine
export class ClinicalIntelligenceEngine{
  private packages:any[];

  constructor(packages:any[]=[]){
    this.packages=packages;
    for(const pkg of packages){KNOWLEDGE_REGISTRY.set(`${pkg.id}@${pkg.version}`,pkg);}
  }

  evaluate(state:any,chiefComplaint?:string){
    const applicable=this.getApplicablePackages(state,chiefComplaint);
    const output={
      questions:[],redFlags:[],focusedExam:[],
      differentialHints:[],orderConsiderations:[],
      followUpRules:[],safetyNet:[],
      careGaps:[],longitudinalInsights:[],
    };

    for(const pkg of applicable){
      this.applyPackage(pkg,state,chiefComplaint,output);
    }
    return this.deduplicateAndSort(output);
  }

  private getApplicablePackages(state:any,chiefComplaint?:string){
    const applicable:any[]=[];
    for(const pkg of this.packages){
      // AUDITORÍA 2026-09-17: la lógica anterior dejaba applies=true siempre (ambas ramas -> true),
      // así que todo paquete aplicaba. Semántica correcta: sin reglas de aplicabilidad -> aplica siempre;
      // con reglas -> aplica si alguna condición matchea con include:true.
      const applies=pkg.applicability.length===0
        ?true
        :pkg.applicability.some((rule:ApplicabilityRule)=>this.evalCondition(rule.condition,state,chiefComplaint)&&rule.include);
      if(applies)applicable.push(pkg);
    }
    return applicable;
  }

  private evalCondition(condition:RuleCondition,state:PatientStateSummary,chiefComplaint?:string):boolean{
    const ctx:RuleContext={age:state.age,sex:state.sex,
      hasProblem:(code:string)=>state.activeProblems.some(p=>p.code.startsWith(code)),
      hasMedication:(code:string)=>state.activeMedications.some(m=>m.code.startsWith(code)),
      hasAllergy:(sub:string)=>state.allergies.some(a=>a.substance.toLowerCase().includes(sub.toLowerCase())),
      chiefComplaint:chiefComplaint??"",
      recentVitals:state.recentVitals,
      recentResults:state.recentResults,
    };
    // Una regla que lanza no dispara (y no tumba la evaluación del resto). Sin `new Function`: la condición es código tipado.
    try{return condition(ctx)===true;}catch{return false;}
  }

  private applyPackage(pkg:any,state:any,chiefComplaint:string|undefined,output:any){
    for(const q of pkg.questions){
      if(this.evalCondition(q.trigger,state,chiefComplaint)){
        output.questions.push({id:q.id,text:q.text,reason:`Knowledge package ${pkg.id}@${pkg.version}`});
      }
    }
    for(const r of pkg.redFlags){
      if(this.evalCondition(r.condition,state,chiefComplaint)){
        output.redFlags.push({id:r.id,message:r.action,severity:r.severity,evidence:r.evidence});
      }
    }
    for(const f of pkg.focusedExam){
      if(this.evalCondition(f.condition,state,chiefComplaint)){
        output.focusedExam.push({id:f.id,instruction:f.action,reason:f.evidence.join("; ")});
      }
    }
    for(const d of pkg.differentialHints){
      if(this.evalCondition(d.condition,state,chiefComplaint)){
        output.differentialHints.push({condition:d.action,probability:0.5,evidence:d.evidence});
      }
    }
    for(const o of pkg.orderConsiderations){
      if(this.evalCondition(o.condition,state,chiefComplaint)){
        output.orderConsiderations.push({orderType:o.action,reason:o.evidence.join("; "),urgency:"ROUTINE"});
      }
    }
    for(const f of pkg.followUpRules){
      if(this.evalCondition(f.condition,state,chiefComplaint)){
        // AUDITORÍA 2026-09-17: antes ponía dueAt:Date.now()+30d -> el motor NO era determinista (dos evaluate()
        // en ms distintos diferían). El vencimiento absoluto es una preocupación de PERSISTENCIA (se calcula desde
        // occurredAt en el handler), no del motor puro. Se emite un intervalo relativo determinista.
        output.followUpRules.push({obligationType:f.action,dueInDays:30,reason:f.evidence.join("; "),priority:"ROUTINE"});
      }
    }
    for(const s of pkg.safetyNet){
      if(this.evalCondition(s.condition,state,chiefComplaint)){
        output.safetyNet.push({message:s.action,action:s.evidence.join("; ")});
      }
    }
  }

  private deduplicateAndSort(output:any){
    const severityOrder:Record<string,number>={CRITICAL:0,IMPORTANT:1,CONSIDER:2,INFO:3};
    const sortedFlags=[...output.redFlags].sort((a,b)=>(severityOrder[a.severity]??99)-(severityOrder[b.severity]??99));
    const seen=new Set<string>();
    const deduped=sortedFlags.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;});
    return {...output,redFlags:deduped};
  }

  registerPackage(pkg:any){this.packages.push(pkg);KNOWLEDGE_REGISTRY.set(`${pkg.id}@${pkg.version}`,pkg);}

  static getPackage(id:string,version:string){
    return KNOWLEDGE_REGISTRY.get(`${id}@${version}`);
  }

  static checkAIRiskTier(tier:"A"|"B"|"C"|"D",operation:string){
    if(tier==="D")throw new Error(`AI Tier D (autonomous) not permitted for: ${operation}`);
    return true;
  }
}

// Pre-built knowledge packages for common scenarios
export const DEFAULT_KNOWLEDGE_PACKAGES:KnowledgePackage[]=[
  {
    id:"chest-pain",version:"1.0",specialty:"emergency",effectiveDate:"2026-01-01",
    reviewers:[{id:"cardiology-chief",role:"cardiologist"}],
    sources:[{citation:"ACC/AHA Guidelines"}],
    applicability:[{condition:(c)=>(c.chiefComplaint==="chest pain"),include:true}],
    questions:[
      {id:"q1",text:"¿Dolor irradiado a brazo/mentón/espalda?",trigger:(c)=>(c.chiefComplaint==="chest pain"),expectedAnswers:["si","no"],required:true},
      {id:"q2",text:"¿Sudoración fría / disnea / náuseas?",trigger:(c)=>(c.chiefComplaint==="chest pain"),expectedAnswers:["si","no"],required:true},
    ],
    redFlags:[
      {id:"rf1",condition:(c)=>(c.chiefComplaint==="chest pain" && c.recentVitals.some(v=>v.type==="HR" && v.value>120)),action:"Taquicardia con dolor torácico: descartar SCA/PE",severity:"CRITICAL",evidence:["ACC Guidelines"],version:"1.0"},
      {id:"rf2",condition:(c)=>(c.chiefComplaint==="chest pain" && c.recentResults.some(r=>r.code==="TROP" && r.value>0.04)),action:"Troponina elevada: SCA probable",severity:"CRITICAL",evidence:["ACC Guidelines"],version:"1.0"},
    ],
    focusedExam:[
      {id:"fe1",condition:(c)=>(c.chiefComplaint==="chest pain"),action:"Auscultación cardíaca/pulmonar; pulsos periféricos; JVP",evidence:["Physical exam guidelines"],severity:"INFO",version:"1.0"},
    ],
    differentialHints:[
      {id:"dh1",condition:(c)=>(c.chiefComplaint==="chest pain"),action:"Síndrome coronario agudo",evidence:["Typical presentation"],severity:"INFO",version:"1.0"},
      {id:"dh2",condition:(c)=>(c.chiefComplaint==="chest pain" && c.recentVitals.some(v=>v.type==="RR" && v.value>24)),action:"Tromboembolismo pulmonar",evidence:["Wells criteria"],severity:"INFO",version:"1.0"},
    ],
    orderConsiderations:[
      {id:"oc1",condition:(c)=>(c.chiefComplaint==="chest pain"),action:"ECG 12 derivaciones STAT",evidence:["ACC Guidelines"],version:"1.0"},
      {id:"oc2",condition:(c)=>(c.chiefComplaint==="chest pain"),action:"Troponina seriada 0/3h",evidence:["ACC Guidelines"],version:"1.0"},
      {id:"oc3",condition:(c)=>(c.chiefComplaint==="chest pain" && c.recentVitals.some(v=>v.type==="RR" && v.value>24)),action:"AngioTC torácica / D-dímero",evidence:["PE workup"],version:"1.0"},
    ],
    followUpRules:[
      {id:"fu1",condition:(c)=>(c.chiefComplaint==="chest pain"),action:"Control cardiología 7 días",evidence:["Post-ACS followup"],version:"1.0"},
    ],
    safetyNet:[
      {id:"sn1",condition:(c)=>(c.chiefComplaint==="chest pain"),action:"Si empeora dolor / disnea / síncope -> reevaluación inmediata",evidence:["Safety net guidelines"],severity:"INFO",version:"1.0"},
    ],
  },
  {
    id:"hypertension-followup",version:"1.0",specialty:"primary-care",effectiveDate:"2026-01-01",
    reviewers:[{id:"pcp-chief",role:"family-medicine"}],
    sources:[{citation:"JNC 8 / ACC/AHA 2017"}],
    applicability:[{condition:(c)=>(c.hasProblem("I10")),include:true}],
    questions:[],
    redFlags:[
      {id:"rf1",condition:(c)=>(c.recentVitals.some(v=>v.type==="BP" && (v.value>180 || v.value<90))),action:"HTA no controlada / crisis hipertensiva",severity:"CRITICAL",evidence:["JNC 8"],version:"1.0"},
    ],
    focusedExam:[
      {id:"fe1",condition:(c)=>(c.hasProblem("I10")),action:"Fundoscopia; ruidos cardíacos; pulsos femorales",evidence:["HTN workup"],severity:"INFO",version:"1.0"},
    ],
    differentialHints:[],
    orderConsiderations:[
      {id:"oc1",condition:(c)=>(c.hasProblem("I10") && c.recentResults.some(r=>r.code==="CREAT" && r.value>1.3)),action:"Monitor función renal / electrolitos",evidence:["ACEI/ARB monitoring"],version:"1.0"},
      {id:"oc2",condition:(c)=>(c.hasProblem("I10") && c.hasMedication("C09")),action:"K+ y Cr a 1-2 semanas de iniciar ARA-II/IECA",evidence:["Guideline monitoring"],version:"1.0"},
    ],
    followUpRules:[
      {id:"fu1",condition:(c)=>(c.hasProblem("I10")),action:"Control BP 1 mes; ACR anual",evidence:["Guideline followup"],version:"1.0"},
    ],
    safetyNet:[],
  },
];