CREATE TABLE `analytics_pageviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`path` text DEFAULT '/' NOT NULL,
	`viewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_pageviews_viewed_at` ON `analytics_pageviews` (`viewed_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_pageviews_session_viewed` ON `analytics_pageviews` (`session_id`,`viewed_at`);--> statement-breakpoint
CREATE TABLE `analytics_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`first_seen` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`path` text DEFAULT '/' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_sessions_last_seen` ON `analytics_sessions` (`last_seen`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`view` text DEFAULT 'home' NOT NULL,
	`session_id` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_created_at` ON `feedback` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_feedback_status_created` ON `feedback` (`status`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
