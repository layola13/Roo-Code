import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"

/**
 * TelemetryEvent 实体
 * 对应设计文档中的 telemetry_events 表
 */
@Entity("telemetry_events")
export class TelemetryEvent {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 36, name: "user_id" })
	@Index()
	userId!: string

	@Column({ type: "varchar", length: 36, name: "organization_id" })
	@Index()
	organizationId!: string

	@Column({ type: "varchar", length: 100, name: "event_type" })
	@Index()
	eventType!: string

	@Column({ type: "json", nullable: true, name: "event_data" })
	eventData?: Record<string, any>

	@CreateDateColumn({ type: "timestamp" })
	@Index()
	timestamp!: Date

	// 关系：所属用户
	@ManyToOne("User", "telemetryEvents", { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user?: any

	// 关系：所属组织
	@ManyToOne("Organization", "telemetryEvents", { onDelete: "CASCADE" })
	@JoinColumn({ name: "organization_id" })
	organization?: any
}
