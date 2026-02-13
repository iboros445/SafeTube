CREATE TABLE `children` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`avatar_color` text DEFAULT '#6366f1' NOT NULL,
	`avatar_type` text DEFAULT 'color' NOT NULL,
	`avatar_emoji` text,
	`avatar_photo` text,
	`theme` text DEFAULT 'dark' NOT NULL,
	`daily_limit_seconds` integer DEFAULT 3600 NOT NULL,
	`current_usage_seconds` integer DEFAULT 0 NOT NULL,
	`last_heartbeat_at` integer,
	`last_reset_date` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `video_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`video_id` integer NOT NULL,
	`progress_seconds` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`youtube_url` text,
	`local_path` text NOT NULL,
	`thumbnail_path` text,
	`subtitle_path` text,
	`duration_seconds` integer,
	`created_at` integer NOT NULL
);
