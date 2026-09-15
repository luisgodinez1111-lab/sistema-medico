
-- Application transaction MUST SET LOCAL app.tenant_id = '<uuid>'.
CREATE POLICY patient_tenant_isolation ON patients USING (tenant_id = current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid);
CREATE POLICY encounter_tenant_isolation ON encounters USING (tenant_id = current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid);
CREATE POLICY result_tenant_isolation ON diagnostic_results USING (tenant_id = current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid);
CREATE POLICY medication_tenant_isolation ON medications USING (tenant_id = current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid);
