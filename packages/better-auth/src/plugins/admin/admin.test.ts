import { describe, expect, it } from "vitest";
import { getTestInstance } from "../../test-utils/test-instance";
import { admin, type UserWithRole } from ".";
import { adminClient } from "./client";

describe("Admin plugin", async () => {
	const { client, signInWithTestUser } = await getTestInstance(
		{
			plugins: [admin()],
			logger: {
				verboseLogging: true,
			},
			databaseHooks: {
				user: {
					create: {
						before: async (user) => {
							if (user.name === "Admin") {
								return {
									data: {
										...user,
										role: "admin",
									},
								};
							}
						},
					},
				},
			},
		},
		{
			testUser: {
				name: "Admin",
			},
			clientOptions: {
				plugins: [adminClient()],
			},
		},
	);
	const { headers: adminHeaders } = await signInWithTestUser();
	let newUser: UserWithRole | undefined;

	it("should allow admin to create users", async () => {
		const res = await client.admin.createUser(
			{
				name: "Test User",
				email: "test2@test.com",
				password: "test",
				role: "user",
			},
			{
				headers: adminHeaders,
			},
		);
		newUser = res.data?.user;
		expect(newUser?.role).toBe("user");
	});

	it("should allow admin to list users", async () => {
		const res = await client.admin.listUsers({
			fetchOptions: {
				headers: adminHeaders,
			},
		});
		expect(res.data?.users.length).toBe(2);
	});

	it("should allow to set user role", async () => {
		const res = await client.admin.setRole(
			{
				userId: newUser?.id || "",
				role: "admin",
			},
			{
				headers: adminHeaders,
			},
		);
		expect(res.data?.user?.role).toBe("admin");
	});

	it("should allow to ban user", async () => {
		const res = await client.admin.banUser(
			{
				userId: newUser?.id || "",
			},
			{
				headers: adminHeaders,
			},
		);
		expect(res.data?.user?.banned).toBe(true);
	});

	it("should not allow banned user to sign in", async () => {
		const res = await client.signIn.email({
			email: newUser?.email || "",
			password: "test",
		});
		expect(res.error?.status).toBe(401);
	});

	it("should allow to unban user", async () => {
		const res = await client.admin.unbanUser(
			{
				userId: newUser?.id || "",
			},
			{
				headers: adminHeaders,
			},
		);
		expect(res.data?.user?.banned).toBe(false);
	});

	it("should allow user to sign in", async () => {
		const res = await client.signIn.email({
			email: "test2@test.com",
			password: "test",
		});
		expect(res.data?.session).toBeDefined();
	});

	it("should allow admin to list user sessions", async () => {
		const res = await client.admin.listUserSessions(
			{
				userId: newUser?.id || "",
			},
			{
				headers: adminHeaders,
			},
		);
		expect(res.data?.sessions.length).toBe(1);
	});

	it("should allow admins to impersonate user", async () => {
		const res = await client.admin.impersonateUser(
			{
				userId: newUser?.id || "",
			},
			{
				headers: adminHeaders,
			},
		);
		expect(res.data?.session).toBeDefined();
		expect(res.data?.user?.id).toBe(newUser?.id);
	});

	it("should allow admin to delete user", async () => {
		const res = await client.admin.removeUser(
			{
				userId: newUser?.id || "",
			},
			{
				headers: adminHeaders,
			},
		);
		expect(res.data?.success).toBe(true);
	});
});
