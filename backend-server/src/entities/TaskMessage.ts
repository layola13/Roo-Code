import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"

/**
 * TaskMessage 实体
 * 对应设计文档中的 task_messages 表
 * 存储 ClineMessage 格式的任务消息
 */
@Entity("task_messages")
export class TaskMessage {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 36, name: "task_id" })
	@Index()
	taskId!: string

	@Column({ type: "varchar", length: 50 })
	type!: string

	@Column({ type: "json" })
	content!: Record<string, any>

	@CreateDateColumn({ type: "timestamp" })
	@Index()
	timestamp!: Date

	// 关系：所属任务
	@ManyToOne("Task", "messages", { onDelete: "CASCADE" })
	@JoinColumn({ name: "task_id" })
	task?: any
}
