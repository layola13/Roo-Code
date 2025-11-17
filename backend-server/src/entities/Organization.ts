import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from "typeorm"

/**
 * Organization 实体
 * 对应设计文档中的 organizations 表
 */
@Entity("organizations")
export class Organization {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 255 })
	@Index()
	name!: string

	@Column({ type: "json", nullable: true })
	settings?: Record<string, any>

	@CreateDateColumn({ name: "created_at" })
	createdAt!: Date

	@UpdateDateColumn({ name: "updated_at" })
	updatedAt!: Date

	// 关系：组织成员
	@OneToMany("OrganizationMembership", "organization")
	memberships?: any[]

	// 关系：组织的任务
	@OneToMany("Task", "organization")
	tasks?: any[]

	// 关系：组织的遥测事件
	@OneToMany("TelemetryEvent", "organization")
	telemetryEvents?: any[]
}
