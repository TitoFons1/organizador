CREATE TABLE `session_record` (
	`slot_id` text NOT NULL,
	`date` text NOT NULL,
	`workspace_id` text NOT NULL,
	`topic` text,
	`questions` text,
	`notes` text,
	`recording_url` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`slot_id`, `date`),
	FOREIGN KEY (`slot_id`) REFERENCES `schedule_slot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_record_workspace_idx` ON `session_record` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`subject_id` text,
	`parent_id` text,
	`created_by` text,
	`visibility` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`due_date` text,
	`due_time` text,
	`priority` text NOT NULL,
	`estimate_min` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_workspace_idx` ON `task` (`workspace_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `task_parent_idx` ON `task` (`parent_id`);--> statement-breakpoint
CREATE INDEX `task_subject_idx` ON `task` (`subject_id`);--> statement-breakpoint
CREATE TABLE `task_progress` (
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`done_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
