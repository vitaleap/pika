CREATE TABLE "user_login_log" (
	"id" varchar(20) PRIMARY KEY,
	"create_at" varchar(30) NOT NULL,
	"create_id" varchar,
	"update_at" varchar(30) NOT NULL,
	"update_id" varchar,
	"user_id" varchar(20),
	"username" varchar(50) NOT NULL,
	"ip" varchar(50) NOT NULL,
	"device_type" varchar(20) NOT NULL,
	"user_agent" varchar(1024) NOT NULL,
	"login_type" varchar(20) NOT NULL,
	"success" boolean NOT NULL,
	"fail_reason" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "user_preference" (
	"id" varchar(20) PRIMARY KEY,
	"create_at" varchar(30) NOT NULL,
	"create_id" varchar,
	"update_at" varchar(30) NOT NULL,
	"update_id" varchar,
	"user_id" varchar(20) NOT NULL UNIQUE,
	"appearance" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" varchar(20) PRIMARY KEY,
	"create_at" varchar(30) NOT NULL,
	"create_id" varchar,
	"update_at" varchar(30) NOT NULL,
	"update_id" varchar,
	"auth" jsonb NOT NULL,
	"mail" jsonb NOT NULL,
	"file" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(20) PRIMARY KEY,
	"create_at" varchar(30) NOT NULL,
	"create_id" varchar,
	"update_at" varchar(30) NOT NULL,
	"update_id" varchar,
	"name" varchar(50) NOT NULL,
	"email" varchar(50) UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_number" varchar(20) UNIQUE,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"password" varchar(255),
	"picture" varchar(500),
	"login_at" varchar(30)
);
