CREATE TABLE `subject` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`color` text NOT NULL,
	`teacher` text,
	`links` text NOT NULL,
	`position` integer NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subject_workspace_idx` ON `subject` (`workspace_id`,`deleted_at`);