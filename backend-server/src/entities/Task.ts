import {
	Entity,
	PrimaryColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
	JoinColumn,
	OneToMany,
	Index,
} from "typeorm"

/**
 * Task 实体
 * 对应设计文档中的 tasks 表
 */
@Entity("tasks")
export class Task {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 36, name: "user_id" })
	@Index()
	userId!: string

	@Column({ type: "varchar", length: 36, name: "organization_id" })
	@Index()
	organizationId!: string

	@Column({ type: "json", nullable: true })
	metadata?: Record<string, any>

	@CreateDateColumn({ name: "created_at" })
	@Index()
	createdAt!: Date

	@UpdateDateColumn({ name: "updated_at" })
	updatedAt!: Date

	// 关系：任务所属用户
	@ManyToOne("User", "tasks", { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user?: any

	// 关系：任务所属组织
	@ManyToOne("Organization", "tasks", { onDelete: "CASCADE" })
	@JoinColumn({ name: "organization_id" })
	organization?: any

	// 关系：任务消息
	@OneToMany("TaskMessage", "task")
	messages?: any[]

	// 关系：任务共享
	@OneToMany("Share", "task")
	shares?: any[]
}
