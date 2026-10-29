CREATE TABLE `schedule_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`kind` text NOT NULL,
	`recurrence` text NOT NULL,
	`weekday` integer,
	`interval_weeks` integer DEFAULT 1 NOT NULL,
	`anchor_date` text,
	`dates` text,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`location` text,
	`meeting_url` text,
	`valid_from` text,
	`valid_to` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedule_slot_workspace_idx` ON `schedule_slot` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `schedule_slot_subject_idx` ON `schedule_slot` (`subject_id`);--> statement-breakpoint
CREATE TABLE `slot_exception` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`new_date` text,
	`new_start` text,
	`new_end` text,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`slot_id`) REFERENCES `schedule_slot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `slot_exception_slot_idx` ON `slot_exception` (`slot_id`,`date`);--> statement-breakpoint
CREATE INDEX `slot_exception_workspace_idx` ON `slot_exception` (`workspace_id`);