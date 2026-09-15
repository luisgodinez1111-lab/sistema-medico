export type ApiError=Readonly<{code:string;message:string;correlationId:string;retryable:boolean}>;
export type ApiResponse<T>={ok:true;data:T;correlationId:string}|{ok:false;error:ApiError};
export function fail(code:string,correlationId:string,retryable=false):ApiResponse<never>{return {ok:false,error:{code,message:code,correlationId,retryable}};}
