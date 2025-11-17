import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from "typeorm"

/**
 * OrganizationMembership 实体
 * 对应设计文档中的 organization_memberships 表
 */
@Entity("organization_memberships")
@Index(["userId", "organizationId"], { unique: true })
export class OrganizationMembership {
	@PrimaryColumn({ type: "varchar", length: 36 })
	id!: string

	@Column({ type: "varchar", length: 36, name: "user_id" })
	@Index()
	userId!: string

	@Column({ type: "varchar", length: 36, name: "organization_id" })
	@Index()
	organizationId!: string

	@Column({ type: "enum", enum: ["owner", "admin", "member"] })
	role!: "owner" | "admin" | "member"

	@CreateDateColumn({ name: "joined_at" })
	joinedAt!: Date

	// 关系：所属用户
	@ManyToOne("User", "memberships", { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user?: any

	// 关系：所属组织
	@ManyToOne("Organization", "memberships", { onDelete: "CASCADE" })
	@JoinColumn({ name: "organization_id" })
	organization?: any
}
