
CREATE POLICY amendment_tenant_isolation ON clinical_amendments USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
