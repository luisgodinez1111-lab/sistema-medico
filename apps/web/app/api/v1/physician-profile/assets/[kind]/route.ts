import{handleProfileAssetUpload,handleProfileAssetDownload,handleProfileAssetRemove}from"../../../../../../lib/physician-profile-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// EPIC S-CONFIG/FIRMA — firma/sello del médico en Blob privado. POST sube (multipart), GET descarga por la
// Function (privado), DELETE quita. kind ∈ {signature, stamp}. Scope settings:write.
export async function POST(req:Request,ctx:{params:Promise<{kind:string}>}){
 const{kind}=await ctx.params;
 return handleProfileAssetUpload(req,kind);
}
export async function GET(req:Request,ctx:{params:Promise<{kind:string}>}){
 const{kind}=await ctx.params;
 return handleProfileAssetDownload(req,kind);
}
export async function DELETE(req:Request,ctx:{params:Promise<{kind:string}>}){
 const{kind}=await ctx.params;
 return handleProfileAssetRemove(req,kind);
}
