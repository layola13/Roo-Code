import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm"

/**
 * 初始数据库架构迁移
 * 创建所有核心表：users, organizations, organization_memberships, tasks, task_messages, shares, telemetry_events
 */
export class InitialSchema1700000000000 implements MigrationInterface {
	name = "InitialSchema1700000000000"

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. 创建 users 表
		await queryRunner.createTable(
			new Table({
				name: "users",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "email",
						type: "varchar",
						length: "255",
						isUnique: true,
						isNullable: false,
					},
					{
						name: "password_hash",
						type: "varchar",
						length: "255",
						isNullable: false,
					},
					{
						name: "name",
						type: "varchar",
						length: "255",
						isNullable: true,
					},
					{
						name: "settings",
						type: "json",
						isNullable: true,
					},
					{
						name: "created_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
					{
						name: "updated_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
						onUpdate: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 users 表的索引
		await queryRunner.createIndex(
			"users",
			new TableIndex({
				name: "IDX_users_email",
				columnNames: ["email"],
			}),
		)

		// 2. 创建 organizations 表
		await queryRunner.createTable(
			new Table({
				name: "organizations",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "name",
						type: "varchar",
						length: "255",
						isNullable: false,
					},
					{
						name: "settings",
						type: "json",
						isNullable: true,
					},
					{
						name: "created_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
					{
						name: "updated_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
						onUpdate: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 organizations 表的索引
		await queryRunner.createIndex(
			"organizations",
			new TableIndex({
				name: "IDX_organizations_name",
				columnNames: ["name"],
			}),
		)

		// 3. 创建 organization_memberships 表
		await queryRunner.createTable(
			new Table({
				name: "organization_memberships",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "user_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "organization_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "role",
						type: "enum",
						enum: ["owner", "admin", "member"],
						isNullable: false,
					},
					{
						name: "joined_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 organization_memberships 表的索引
		await queryRunner.createIndex(
			"organization_memberships",
			new TableIndex({
				name: "IDX_organization_memberships_user_id",
				columnNames: ["user_id"],
			}),
		)

		await queryRunner.createIndex(
			"organization_memberships",
			new TableIndex({
				name: "IDX_organization_memberships_organization_id",
				columnNames: ["organization_id"],
			}),
		)

		await queryRunner.createIndex(
			"organization_memberships",
			new TableIndex({
				name: "IDX_organization_memberships_user_org",
				columnNames: ["user_id", "organization_id"],
				isUnique: true,
			}),
		)

		// 创建 organization_memberships 表的外键
		await queryRunner.createForeignKey(
			"organization_memberships",
			new TableForeignKey({
				name: "FK_organization_memberships_user",
				columnNames: ["user_id"],
				referencedTableName: "users",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		await queryRunner.createForeignKey(
			"organization_memberships",
			new TableForeignKey({
				name: "FK_organization_memberships_organization",
				columnNames: ["organization_id"],
				referencedTableName: "organizations",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		// 4. 创建 tasks 表
		await queryRunner.createTable(
			new Table({
				name: "tasks",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "user_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "organization_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "metadata",
						type: "json",
						isNullable: true,
					},
					{
						name: "created_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
					{
						name: "updated_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
						onUpdate: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 tasks 表的索引
		await queryRunner.createIndex(
			"tasks",
			new TableIndex({
				name: "IDX_tasks_user_id",
				columnNames: ["user_id"],
			}),
		)

		await queryRunner.createIndex(
			"tasks",
			new TableIndex({
				name: "IDX_tasks_organization_id",
				columnNames: ["organization_id"],
			}),
		)

		await queryRunner.createIndex(
			"tasks",
			new TableIndex({
				name: "IDX_tasks_created_at",
				columnNames: ["created_at"],
			}),
		)

		// 创建 tasks 表的外键
		await queryRunner.createForeignKey(
			"tasks",
			new TableForeignKey({
				name: "FK_tasks_user",
				columnNames: ["user_id"],
				referencedTableName: "users",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		await queryRunner.createForeignKey(
			"tasks",
			new TableForeignKey({
				name: "FK_tasks_organization",
				columnNames: ["organization_id"],
				referencedTableName: "organizations",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		// 5. 创建 task_messages 表
		await queryRunner.createTable(
			new Table({
				name: "task_messages",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "task_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "type",
						type: "varchar",
						length: "50",
						isNullable: false,
					},
					{
						name: "content",
						type: "json",
						isNullable: false,
					},
					{
						name: "timestamp",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 task_messages 表的索引
		await queryRunner.createIndex(
			"task_messages",
			new TableIndex({
				name: "IDX_task_messages_task_id",
				columnNames: ["task_id"],
			}),
		)

		await queryRunner.createIndex(
			"task_messages",
			new TableIndex({
				name: "IDX_task_messages_timestamp",
				columnNames: ["timestamp"],
			}),
		)

		// 创建 task_messages 表的外键
		await queryRunner.createForeignKey(
			"task_messages",
			new TableForeignKey({
				name: "FK_task_messages_task",
				columnNames: ["task_id"],
				referencedTableName: "tasks",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		// 6. 创建 shares 表
		await queryRunner.createTable(
			new Table({
				name: "shares",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "task_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "share_url",
						type: "varchar",
						length: "255",
						isUnique: true,
						isNullable: false,
					},
					{
						name: "visibility",
						type: "enum",
						enum: ["public", "organization"],
						isNullable: false,
					},
					{
						name: "created_by",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "created_at",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 shares 表的索引
		await queryRunner.createIndex(
			"shares",
			new TableIndex({
				name: "IDX_shares_task_id",
				columnNames: ["task_id"],
			}),
		)

		await queryRunner.createIndex(
			"shares",
			new TableIndex({
				name: "IDX_shares_share_url",
				columnNames: ["share_url"],
			}),
		)

		// 创建 shares 表的外键
		await queryRunner.createForeignKey(
			"shares",
			new TableForeignKey({
				name: "FK_shares_task",
				columnNames: ["task_id"],
				referencedTableName: "tasks",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		await queryRunner.createForeignKey(
			"shares",
			new TableForeignKey({
				name: "FK_shares_creator",
				columnNames: ["created_by"],
				referencedTableName: "users",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		// 7. 创建 telemetry_events 表
		await queryRunner.createTable(
			new Table({
				name: "telemetry_events",
				columns: [
					{
						name: "id",
						type: "varchar",
						length: "36",
						isPrimary: true,
					},
					{
						name: "user_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "organization_id",
						type: "varchar",
						length: "36",
						isNullable: false,
					},
					{
						name: "event_type",
						type: "varchar",
						length: "100",
						isNullable: false,
					},
					{
						name: "event_data",
						type: "json",
						isNullable: true,
					},
					{
						name: "timestamp",
						type: "timestamp",
						default: "CURRENT_TIMESTAMP",
					},
				],
			}),
			true,
		)

		// 创建 telemetry_events 表的索引
		await queryRunner.createIndex(
			"telemetry_events",
			new TableIndex({
				name: "IDX_telemetry_events_user_id",
				columnNames: ["user_id"],
			}),
		)

		await queryRunner.createIndex(
			"telemetry_events",
			new TableIndex({
				name: "IDX_telemetry_events_organization_id",
				columnNames: ["organization_id"],
			}),
		)

		await queryRunner.createIndex(
			"telemetry_events",
			new TableIndex({
				name: "IDX_telemetry_events_event_type",
				columnNames: ["event_type"],
			}),
		)

		await queryRunner.createIndex(
			"telemetry_events",
			new TableIndex({
				name: "IDX_telemetry_events_timestamp",
				columnNames: ["timestamp"],
			}),
		)

		// 创建 telemetry_events 表的外键
		await queryRunner.createForeignKey(
			"telemetry_events",
			new TableForeignKey({
				name: "FK_telemetry_events_user",
				columnNames: ["user_id"],
				referencedTableName: "users",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)

		await queryRunner.createForeignKey(
			"telemetry_events",
			new TableForeignKey({
				name: "FK_telemetry_events_organization",
				columnNames: ["organization_id"],
				referencedTableName: "organizations",
				referencedColumnNames: ["id"],
				onDelete: "CASCADE",
			}),
		)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// 按照依赖关系的逆序删除表（先删除有外键的表）

		// 7. 删除 telemetry_events 表
		await queryRunner.dropTable("telemetry_events", true)

		// 6. 删除 shares 表
		await queryRunner.dropTable("shares", true)

		// 5. 删除 task_messages 表
		await queryRunner.dropTable("task_messages", true)

		// 4. 删除 tasks 表
		await queryRunner.dropTable("tasks", true)

		// 3. 删除 organization_memberships 表
		await queryRunner.dropTable("organization_memberships", true)

		// 2. 删除 organizations 表
		await queryRunner.dropTable("organizations", true)

		// 1. 删除 users 表
		await queryRunner.dropTable("users", true)
	}
}
