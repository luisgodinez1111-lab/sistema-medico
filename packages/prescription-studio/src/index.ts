// EPIC J — Prescription Studio: visual template renderer over structured clinical data.
// EXEC-0015: Never allow visual customization to delete mandatory/required information.
// Separate: clinical prescription data FROM visual template FROM rendered artifact.
// A template node may position or style approved fields, but it must NOT become the clinical source of truth.
// Rendered prescription SHOULD be reproducible from signed clinical data + template version.
// Autoridad: PROD (receta clínica), CAP-PRESCRIPTION-STUDIO-001.

export type PrescriptionClinicalData=Readonly<{
  // Datos clínicos obligatorios (fuente de verdad)
  medicationId:string;
  patientId:string;
  prescriberId:string;
  drugCode:string;
  drugName:string;
  dose:string;           // Dosis prescrita (no calculada)
  route:string;
  frequency:string;
  duration:string;
  indication:string;
  prescribedAt:string;
  calculatedDose?:string;// Dosis calculada (referencia)
  prescriberSignature:string; // signatureDigest del médico
  contentHash:string;    // Hash del contenido clínico
}>;

export type PrescriptionTemplate=Readonly<{
  // Template visual vX.Y - SOLO posicionamiento/estilo, NUNCA datos clínicos
  version:string;
  name:string;
  // Coordenadas/estilos para cada campo clínico (no valores)
  layout:Readonly<Record<string,{x:number;y:number;fontSize:number;fontWeight:string;maxWidth:number}>>;
  // Metadatos del template
  mandatoryFields:readonly string[]; // Campos que NUNCA pueden ocultarse
  approvedFields:readonly string[];  // Campos permitidos en template
}>;

// Template base v1.0 (default institucional)
export const BASE_TEMPLATE_V1:PrescriptionTemplate={
  version:"1.0.0",
  name:"Institucional v1.0",
  mandatoryFields:["drugName","dose","route","frequency","duration","indication","prescriberSignature","prescribedAt","contentHash"],
  approvedFields:["drugName","dose","route","frequency","duration","indication","calculatedDose","prescriberSignature","prescribedAt","contentHash","patientId","medicationId","prescriberId"],
  layout:{
    drugName:{x:50,y:50,fontSize:14,fontWeight:"bold",maxWidth:400},
    dose:{x:50,y:80,fontSize:12,fontWeight:"normal",maxWidth:200},
    route:{x:300,y:80,fontSize:12,fontWeight:"normal",maxWidth:150},
    frequency:{x:50,y:110,fontSize:12,fontWeight:"normal",maxWidth:200},
    duration:{x:300,y:110,fontSize:12,fontWeight:"normal",maxWidth:150},
    indication:{x:50,y:140,fontSize:11,fontWeight:"normal",maxWidth:450},
    calculatedDose:{x:50,y:170,fontSize:10,fontWeight:"normal",maxWidth:200},
    prescriberSignature:{x:50,y:220,fontSize:11,fontWeight:"normal",maxWidth:300},
    prescribedAt:{x:50,y:240,fontSize:10,fontWeight:"normal",maxWidth:200},
    contentHash:{x:50,y:260,fontSize:8,fontWeight:"normal",maxWidth:300},
  },
};

// Valida que template no omita campos obligatorios
export function validateTemplate(template:PrescriptionTemplate):{valid:boolean;errors:string[]}{
  const errors:string[]=[];
  for(const field of BASE_TEMPLATE_V1.mandatoryFields){
    if(!template.approvedFields.includes(field)){
      errors.push(`Campo obligatorio ausente en template: ${field}`);
    }
  }
  if(template.mandatoryFields.some(f=>!BASE_TEMPLATE_V1.mandatoryFields.includes(f))){
    errors.push("Template declara campos obligatorios no estándar");
  }
  return{valid:errors.length===0,errors};
}

// Renderiza receta: clinicalData + template -> artifact reproducible
export function renderPrescription(clinicalData:PrescriptionClinicalData,template:PrescriptionTemplate=BASE_TEMPLATE_V1):{artifact:string;contentHash:string;templateVersion:string}{
  // Validar template
  const validation=validateTemplate(template);
  if(!validation.valid)throw new Error(`Template inválido: ${validation.errors.join("; ")}`);
  // Validar que clinicalData tenga todos los campos obligatorios
  for(const field of template.mandatoryFields){
    if(!(field in clinicalData)||(clinicalData as Record<string,unknown>)[field]===undefined||(clinicalData as Record<string,unknown>)[field]===""){
      throw new Error(`Campo clínico obligatorio faltante: ${field}`);
    }
  }
  // Construir artifact determinista (JSON para reproducibilidad)
  const artifact=JSON.stringify({clinicalData,templateVersion:template.version},null,2);
  // contentHash del contenido clínico (sin template) para verificación
  const clinicalOnly=JSON.stringify(Object.fromEntries(template.mandatoryFields.map(k=>[k,(clinicalData as Record<string,unknown>)[k]])),null,2);
  const contentHash=require("crypto").createHash("sha256").update(clinicalOnly).digest("hex");
  return{artifact,contentHash,templateVersion:template.version};
}

// Verifica que un artifact renderizado coincida con datos clínicos + template version
export function verifyPrescription(artifact:string,clinicalData:PrescriptionClinicalData,template:PrescriptionTemplate=BASE_TEMPLATE_V1):{valid:boolean;errors:string[]}{
  try{
    const parsed=JSON.parse(artifact);
    if(!parsed.clinicalData||!parsed.templateVersion)return{valid:false,errors:["Artifact malformado"]};
    if(parsed.templateVersion!==template.version)return{valid:false,errors:[`Versión template mismatch: ${parsed.templateVersion} vs ${template.version}`]};
    // Verificar campos obligatorios
    const errors:string[]=[];
    for(const field of template.mandatoryFields){
      if(parsed.clinicalData[field]!==clinicalData[field as keyof PrescriptionClinicalData]){
        errors.push(`Mismatch en campo obligatorio: ${field}`);
      }
    }
    return{valid:errors.length===0,errors};
  }catch{
    return{valid:false,errors:["Artifact no parseable"]};
  }
}