CREATE TABLE `daily_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wishes` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`available_at` integer NOT NULL,
	`cheers` integer DEFAULT 0 NOT NULL,
	`reports` integer DEFAULT 0 NOT NULL,
	`delete_hash` text NOT NULL
);
