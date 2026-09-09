-- Give "setting" the same update_at trigger protection as the other tables.
-- Prisma @updatedAt still writes the column; this keeps direct SQL updates
-- by operators stamped as well.

CREATE OR REPLACE FUNCTION set_setting_update_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.update_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_setting_update_at
BEFORE UPDATE ON "setting"
FOR EACH ROW
EXECUTE FUNCTION set_setting_update_at();
