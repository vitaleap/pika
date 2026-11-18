CREATE TABLE "user_multi_factor" (
	"id" varchar(20) PRIMARY KEY,
	"create_at" varchar(30) NOT NULL,
	"create_id" varchar,
	"update_at" varchar(30) NOT NULL,
	"update_id" varchar,
	"user_id" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"secret" varchar(255),
	"codes" text,
	"last_used_counter" integer
);
--> statement-breakpoint
CREATE TABLE "user_multi_factor_log" (
	"id" varchar(20) PRIMARY KEY,
	"create_at" varchar(30) NOT NULL,
	"create_id" varchar,
	"update_at" varchar(30) NOT NULL,
	"update_id" varchar,
	"user_id" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"ip" varchar(50) NOT NULL,
	"user_agent" varchar(1024) NOT NULL,
	"success" boolean NOT NULL,
	"fail_reason" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "multi_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_multi_factor_user_id_type_idx" ON "user_multi_factor" ("user_id","type");--> statement-breakpoint
CREATE INDEX "user_multi_factor_log_user_id_create_at_idx" ON "user_multi_factor_log" ("user_id","create_at");