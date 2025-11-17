import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"

/**
 * Share 实体
 * 对应设计文档中的 shares 表
 */
@Entity("shares")
export class Share {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 36, name: "task_id" })
	@Index()
	taskId!: string

	@Column({ type: "varchar", length: 255, unique: true, name: "share_url" })
	@Index()
	shareUrl!: string

	@Column({ type: "enum", enum: ["public", "organization"] })
	visibility!: "public" | "organization"

	@Column({ type: "varchar", length: 36, name: "created_by" })
	createdBy!: string

	@CreateDateColumn({ name: "created_at" })
	createdAt!: Date

	// 关系：所属任务
	@ManyToOne("Task", "shares", { onDelete: "CASCADE" })
	@JoinColumn({ name: "task_id" })
	task?: any

	// 关系：创建者
	@ManyToOne("User", "shares", { onDelete: "CASCADE" })
	@JoinColumn({ name: "created_by" })
	creator?: any
}
