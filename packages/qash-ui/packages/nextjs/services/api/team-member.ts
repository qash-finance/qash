
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth } from "./index";
import {
	TeamMemberResponseDto,
	TeamMemberWithRelationsResponseDto,
	TeamMemberStatsResponseDto,
	UpdateTeamMemberDto,
	UpdateTeamMemberRoleDto,
	InviteTeamMemberDto,
	BulkInviteTeamMembersDto,
	AcceptInvitationDto,
	AcceptInvitationByTokenDto,
	TeamMemberSearchQueryDto,
	CreateTeamMemberDto,
} from "@qash/types/dto/team-member";
import { useAuth } from "../auth/context";

// =====================================================
// ============== TEAM MEMBER CRUD OPERATIONS ==========
// =====================================================

/**
 * Fetch all team members for a company
 */
export async function getCompanyTeamMembers(
	companyId: number,
	filters?: TeamMemberSearchQueryDto
): Promise<TeamMemberResponseDto[]> {
	const params = new URLSearchParams();
	if (filters) {
		if (filters.role) params.append("role", filters.role);
		if (filters.status) params.append("status", filters.status);
		if (filters.hasUser !== undefined) params.append("hasUser", String(filters.hasUser));
		if (filters.search) params.append("search", filters.search);
	}
	const url = `/kyb/companies/${companyId}/team-members${params.toString() ? `?${params}` : ""}`;
	return apiServerWithAuth.getData<TeamMemberResponseDto[]>(url);
}

/**
 * React Query hook to fetch company team members
 */
export function useGetCompanyTeamMembers(
	companyId?: number,
	filters?: TeamMemberSearchQueryDto,
	options?: { enabled?: boolean }
) {
	return useQuery<TeamMemberResponseDto[]>({
		queryKey: ["kyb", "companies", companyId, "team-members", filters],
		queryFn: () => {
			if (!companyId) throw new Error("companyId is required");
			return getCompanyTeamMembers(companyId, filters);
		},
		enabled: !!companyId && (options?.enabled !== false),
		staleTime: 0,
		refetchOnMount: true,
		refetchOnWindowFocus: false,
		refetchOnReconnect: true,
	});
}

/**
 * Get team member by ID
 */
export async function getTeamMemberById(
	teamMemberId: number
): Promise<TeamMemberWithRelationsResponseDto> {
	const url = `/kyb/team-members/${teamMemberId}`;
	return apiServerWithAuth.getData<TeamMemberWithRelationsResponseDto>(url);
}

/**
 * React Query hook to fetch a single team member
 */
export function useGetTeamMemberById(
	teamMemberId?: number,
	options?: { enabled?: boolean }
) {
	return useQuery<TeamMemberWithRelationsResponseDto>({
		queryKey: ["kyb", "team-members", teamMemberId],
		queryFn: () => {
			if (!teamMemberId) throw new Error("teamMemberId is required");
			return getTeamMemberById(teamMemberId);
		},
		enabled: !!teamMemberId && (options?.enabled !== false),
		staleTime: 30000,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});
}

/**
 * Get team statistics
 */
export async function getTeamStats(
	companyId: number
): Promise<TeamMemberStatsResponseDto> {
	const url = `/kyb/companies/${companyId}/team-members/stats`;
	return apiServerWithAuth.getData<TeamMemberStatsResponseDto>(url);
}

/**
 * React Query hook to fetch team statistics
 */
export function useGetTeamStats(
	companyId?: number,
	options?: { enabled?: boolean }
) {
	return useQuery<TeamMemberStatsResponseDto>({
		queryKey: ["kyb", "companies", companyId, "team-members", "stats"],
		queryFn: () => {
			if (!companyId) throw new Error("companyId is required");
			return getTeamStats(companyId);
		},
		enabled: !!companyId && (options?.enabled !== false),
		staleTime: 60000,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});
}

/**
 * Update a team member
 */
export async function updateTeamMember(
	teamMemberId: number,
	updateDto: UpdateTeamMemberDto
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/team-members/${teamMemberId}`;
	return apiServerWithAuth.putData<TeamMemberResponseDto>(url, updateDto);
}

/**
 * React Query hook to update a team member
 */
export function useUpdateTeamMember() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ teamMemberId: number; updateDto: UpdateTeamMemberDto }
	>({
		mutationFn: ({ teamMemberId, updateDto }) =>
			updateTeamMember(teamMemberId, updateDto),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "team-members", data.id] });
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Update team member role
 */
export async function updateTeamMemberRole(
	teamMemberId: number,
	updateRoleDto: UpdateTeamMemberRoleDto
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/team-members/${teamMemberId}/role`;
	return apiServerWithAuth.putData<TeamMemberResponseDto>(url, updateRoleDto);
}

/**
 * React Query hook to update team member role
 */
export function useUpdateTeamMemberRole() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ teamMemberId: number; updateRoleDto: UpdateTeamMemberRoleDto }
	>({
		mutationFn: ({ teamMemberId, updateRoleDto }) =>
			updateTeamMemberRole(teamMemberId, updateRoleDto),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "team-members", data.id] });
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Remove team member
 */
export async function removeTeamMember(teamMemberId: number): Promise<void> {
	const url = `/kyb/team-members/${teamMemberId}`;
	return apiServerWithAuth.deleteData(url);
}

/**
 * React Query hook to remove a team member
 */
export function useRemoveTeamMember() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<void, Error, { teamMemberId: number; companyId: number }>({
		mutationFn: ({ teamMemberId }) => removeTeamMember(teamMemberId),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", variables.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Suspend team member
 */
export async function suspendTeamMember(
	teamMemberId: number
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/team-members/${teamMemberId}/suspend`;
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, {});
}

/**
 * React Query hook to suspend a team member
 */
export function useSuspendTeamMember() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ teamMemberId: number; companyId: number }
	>({
		mutationFn: ({ teamMemberId }) => suspendTeamMember(teamMemberId),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "team-members", data.id] });
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Reactivate team member
 */
export async function reactivateTeamMember(
	teamMemberId: number
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/team-members/${teamMemberId}/reactivate`;
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, {});
}

/**
 * React Query hook to reactivate a team member
 */
export function useReactivateTeamMember() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ teamMemberId: number; companyId: number }
	>({
		mutationFn: ({ teamMemberId }) => reactivateTeamMember(teamMemberId),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "team-members", data.id] });
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Create team member directly
 */
export async function createTeamMember(
	createDto: InviteTeamMemberDto & { companyId: number }
): Promise<TeamMemberResponseDto> {
	const url = "/kyb/team-members";
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, createDto);
}

/**
 * React Query hook to create a team member
 */
export function useCreateTeamMember() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		InviteTeamMemberDto & { companyId: number }
	>({
		mutationFn: (createDto) => createTeamMember(createDto),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
			refreshUser();
		},
	});
}

// =====================================================
// ============== INVITATION OPERATIONS ================
// =====================================================

/**
 * Invite team member
 */
export async function inviteTeamMember(
	companyId: number,
	inviteDto: InviteTeamMemberDto
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/companies/${companyId}/team-members/invite`;
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, inviteDto);
}

/**
 * React Query hook to invite a team member
 */
export function useInviteTeamMember() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ companyId: number; inviteDto: InviteTeamMemberDto }
	>({
		mutationFn: ({ companyId, inviteDto }) =>
			inviteTeamMember(companyId, inviteDto),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Bulk invite team members
 */
export interface BulkInviteResponse {
	successful: TeamMemberResponseDto[];
	failed: Array<{ email: string; reason: string }>;
	totalProcessed: number;
	successCount: number;
	failureCount: number;
}

export async function bulkInviteTeamMembers(
	companyId: number,
	bulkInviteDto: BulkInviteTeamMembersDto
): Promise<BulkInviteResponse> {
	const url = `/kyb/companies/${companyId}/team-members/bulk-invite`;
	return apiServerWithAuth.postData<BulkInviteResponse>(url, bulkInviteDto);
}

/**
 * React Query hook to bulk invite team members
 */
export function useBulkInviteTeamMembers() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		BulkInviteResponse,
		Error,
		{ companyId: number; bulkInviteDto: BulkInviteTeamMembersDto }
	>({
		mutationFn: ({ companyId, bulkInviteDto }) =>
			bulkInviteTeamMembers(companyId, bulkInviteDto),
		onSuccess: (data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", variables.companyId, "team-members"] });
			refreshUser();
		},
	});
}

/**
 * Get pending invitations for current user
 */
export async function getPendingInvitations(): Promise<TeamMemberWithRelationsResponseDto[]> {
	const url = "/kyb/invitations/pending";
	return apiServerWithAuth.getData<TeamMemberWithRelationsResponseDto[]>(url);
}

/**
 * React Query hook to fetch pending invitations
 */
export function useGetPendingInvitations(options?: { enabled?: boolean }) {
	return useQuery<TeamMemberWithRelationsResponseDto[]>({
		queryKey: ["kyb", "invitations", "pending"],
		queryFn: () => getPendingInvitations(),
		enabled: options?.enabled !== false,
		staleTime: 0,
		refetchOnMount: true,
		refetchOnWindowFocus: false,
		refetchOnReconnect: true,
	});
}

/**
 * Accept team invitation by ID
 */
export async function acceptInvitation(
	teamMemberId: number,
	acceptDto?: AcceptInvitationDto
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/invitations/${teamMemberId}/accept`;
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, acceptDto || {});
}

/**
 * React Query hook to accept a team invitation
 */
export function useAcceptInvitation() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ teamMemberId: number; acceptDto?: AcceptInvitationDto }
	>({
		mutationFn: ({ teamMemberId, acceptDto }) =>
			acceptInvitation(teamMemberId, acceptDto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "invitations", "pending"] });
			queryClient.invalidateQueries({ queryKey: ["kyb", "my-memberships"] });
			refreshUser();
		},
	});
}

/**
 * Accept team invitation by token (public endpoint)
 */
export async function acceptInvitationByToken(
	acceptByTokenDto: AcceptInvitationByTokenDto
): Promise<TeamMemberResponseDto> {
	const url = "/kyb/invitations/accept-by-token";
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, acceptByTokenDto);
}

/**
 * React Query hook to accept invitation by token
 */
export function useAcceptInvitationByToken() {
	const queryClient = useQueryClient();
	const { refreshUser } = useAuth();

	return useMutation<TeamMemberResponseDto, Error, { token: string }>({
		mutationFn: ({ token }) => acceptInvitationByToken({ token }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "invitations", "pending"] });
			queryClient.invalidateQueries({ queryKey: ["kyb", "my-memberships"] });
			refreshUser();
		},
	});
}

/**
 * Resend team invitation
 */
export async function resendInvitation(
	teamMemberId: number
): Promise<TeamMemberResponseDto> {
	const url = `/kyb/invitations/${teamMemberId}/resend`;
	return apiServerWithAuth.postData<TeamMemberResponseDto>(url, {});
}

/**
 * React Query hook to resend team invitation
 */
export function useResendInvitation() {
	const queryClient = useQueryClient();

	return useMutation<
		TeamMemberResponseDto,
		Error,
		{ teamMemberId: number; companyId: number }
	>({
		mutationFn: ({ teamMemberId }) => resendInvitation(teamMemberId),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["kyb", "companies", data.companyId, "team-members"] });
		},
	});
}

// =====================================================
// ============== USER MEMBERSHIPS ====================
// =====================================================

/**
 * Get all companies where user is a team member
 */
export async function getUserMemberships(): Promise<TeamMemberWithRelationsResponseDto[]> {
	const url = "/kyb/my-memberships";
	return apiServerWithAuth.getData<TeamMemberWithRelationsResponseDto[]>(url);
}

/**
 * React Query hook to fetch user's team memberships
 */
export function useGetUserMemberships(options?: { enabled?: boolean }) {
	return useQuery<TeamMemberWithRelationsResponseDto[]>({
		queryKey: ["kyb", "my-memberships"],
		queryFn: () => getUserMemberships(),
		enabled: options?.enabled !== false,
		staleTime: 30000,
		refetchOnMount: true,
		refetchOnWindowFocus: false,
		refetchOnReconnect: true,
	});
}
