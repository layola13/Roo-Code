import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from "typeorm"

/**
 * User 实体
 * 对应设计文档中的 users 表
 */
@Entity("users")
export class User {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 255, unique: true })
	@Index()
	email!: string

	@Column({ type: "varchar", length: 255, name: "password_hash" })
	passwordHash!: string

	@Column({ type: "varchar", length: 255, nullable: true })
	name?: string

	@Column({ type: "json", nullable: true })
	settings?: Record<string, any>

	@CreateDateColumn({ name: "created_at" })
	createdAt!: Date

	@UpdateDateColumn({ name: "updated_at" })
	updatedAt!: Date

	// 关系：用户的组织成员关系
	@OneToMany("OrganizationMembership", "user")
	memberships?: any[]

	// 关系：用户创建的任务
	@OneToMany("Task", "user")
	tasks?: any[]

	// 关系：用户创建的共享
	@OneToMany("Share", "creator")
	shares?: any[]

	// 关系：用户的遥测事件
	@OneToMany("TelemetryEvent", "user")
	telemetryEvents?: any[]
}
