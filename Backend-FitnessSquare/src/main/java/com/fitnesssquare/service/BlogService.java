package com.fitnesssquare.service;

import com.fitnesssquare.model.BlogPost;
import com.fitnesssquare.model.Comment;
import com.fitnesssquare.model.AuditLog;
import com.fitnesssquare.repository.BlogRepository;
import com.fitnesssquare.repository.CommentRepository;
import com.fitnesssquare.repository.ReportRepository;
import com.fitnesssquare.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import com.fitnesssquare.model.User;
import com.fitnesssquare.dto.ModerationHistoryDTO;
import com.fitnesssquare.dto.ReportDTO;
import com.fitnesssquare.repository.UserRepository;

@Service
public class BlogService {

    @Autowired
    private BlogRepository blogRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UserRepository userRepository;

    public BlogPost createPost(BlogPost post) {
        post.setCreatedAt(LocalDateTime.now());
        post.setUpdatedAt(LocalDateTime.now());

        // Auto-Moderation: Basic Profanity Filter
        if (containsProfanity(post.getTitle()) || containsProfanity(post.getContent())) {
            post.setStatus("FLAGGED_AUTO");
            BlogPost saved = blogRepository.save(post);
            logAction("POST_AUTO_FLAGGED", "SYSTEM", saved.getId(), "Post flagged for profanity upon creation.");
            return saved;
        }

        // Default status is PENDING for normal users, PUBLISHED handled by controller
        // for admins
        if (post.getStatus() == null) {
            post.setStatus("PENDING");
        }
        return blogRepository.save(post);
    }

    private boolean containsProfanity(String text) {
        if (text == null)
            return false;
        String lower = text.toLowerCase();
        // Simple mock list of forbidden words for demonstration
        String[] badWords = { "spam", "abuse", "fake news" };
        for (String word : badWords) {
            if (lower.contains(word))
                return true;
        }
        return false;
    }

    private void logAction(String actionType, String moderatorId, String targetId, String details) {
        AuditLog log = new AuditLog();
        log.setActionType(actionType);
        log.setModeratorId(moderatorId);
        log.setTargetId(targetId);
        log.setDetails(details);
        log.setTimestamp(LocalDateTime.now());
        auditLogRepository.save(log);
    }

    public List<BlogPost> getAllPublishedPosts() {
        return blogRepository.findByStatusAndArchivedFalseOrderByCreatedAtDesc("PUBLISHED");
    }

    public List<BlogPost> getPendingPosts() {
        return blogRepository.findByStatusInOrderByCreatedAtDesc(java.util.Arrays.asList("PENDING", "FLAGGED_AUTO"));
    }

    public List<BlogPost> getMyPosts(String userId) {
        return blogRepository.findByAuthorIdAndArchivedFalseOrderByCreatedAtDesc(userId);
    }

    public Optional<BlogPost> getPostById(String id) {
        return blogRepository.findById(id);
    }

    public BlogPost updatePostStatus(String id, String status, String moderatorId) {
        Optional<BlogPost> postOpt = blogRepository.findById(id);
        if (postOpt.isPresent()) {
            BlogPost post = postOpt.get();
            post.setStatus(status);
            post.setUpdatedAt(LocalDateTime.now());
            BlogPost saved = blogRepository.save(post);

            // Audit Log
            String snippet = "Author: " + (post.getAuthorName() != null ? post.getAuthorName() : "Unknown")
                    + " | Content: " + (post.getTitle() != null ? post.getTitle() : "Untitled Post");
            logAction("POST_" + status.toUpperCase(), moderatorId, saved.getId(), snippet);
            return saved;
        }
        throw new RuntimeException("Post not found");
    }

    public BlogPost archivePost(String id, String userId, boolean archive) {
        Optional<BlogPost> postOpt = blogRepository.findById(id);
        if (postOpt.isPresent()) {
            BlogPost post = postOpt.get();
            if (!post.getAuthorId().equals(userId)) {
                throw new RuntimeException("You can only archive your own posts.");
            }
            post.setArchived(archive);
            post.setUpdatedAt(LocalDateTime.now());
            return blogRepository.save(post);
        }
        throw new RuntimeException("Post not found");
    }

    public List<BlogPost> getArchivedPosts(String userId) {
        return blogRepository.findByAuthorIdAndArchivedTrueOrderByCreatedAtDesc(userId);
    }

    public User toggleSavePost(String postId, String userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getSavedPosts() == null) {
                user.setSavedPosts(new java.util.ArrayList<>());
            }
            if (user.getSavedPosts().contains(postId)) {
                user.getSavedPosts().remove(postId);
            } else {
                user.getSavedPosts().add(postId);
            }
            return userRepository.save(user);
        }
        throw new RuntimeException("User not found");
    }

    public List<BlogPost> getSavedPosts(String userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getSavedPosts() == null || user.getSavedPosts().isEmpty()) {
                return new java.util.ArrayList<>();
            }
            List<BlogPost> savedPosts = new java.util.ArrayList<>();
            for (String postId : user.getSavedPosts()) {
                blogRepository.findById(postId).ifPresent(post -> {
                    if ("PUBLISHED".equals(post.getStatus()) && !post.isArchived()) {
                        savedPosts.add(post);
                    }
                });
            }
            return savedPosts;
        }
        return new java.util.ArrayList<>();
    }

    public List<BlogPost> getReportedPostsByUser(String userId) {
        List<com.fitnesssquare.model.Report> postReports = reportRepository.findByReporterIdAndTargetType(userId,
                "POST");
        List<com.fitnesssquare.model.Report> commentReports = reportRepository.findByReporterIdAndTargetType(userId,
                "COMMENT");

        java.util.Set<String> postIds = new java.util.HashSet<>();

        if (postReports != null) {
            for (com.fitnesssquare.model.Report r : postReports) {
                postIds.add(r.getTargetId());
            }
        }

        if (commentReports != null) {
            for (com.fitnesssquare.model.Report r : commentReports) {
                commentRepository.findById(r.getTargetId()).ifPresent(comment -> {
                    postIds.add(comment.getPostId());
                });
            }
        }

        if (postIds.isEmpty()) {
            return new java.util.ArrayList<>();
        }

        List<BlogPost> reportedPosts = new java.util.ArrayList<>();
        for (String postId : postIds) {
            blogRepository.findById(postId).ifPresent(post -> {
                if ("PUBLISHED".equals(post.getStatus()) && !post.isArchived()) {
                    reportedPosts.add(post);
                }
            });
        }

        reportedPosts.sort((p1, p2) -> p2.getCreatedAt().compareTo(p1.getCreatedAt()));

        return reportedPosts;
    }

    private void validateReportReason(String reason) {
        if (reason == null)
            throw new RuntimeException("Invalid report reason");
        List<String> validReasons = java.util.Arrays.asList("Spam", "Abusive", "Misinformation",
                "Irrelevant", "Wrong");
        if (!validReasons.contains(reason)) {
            throw new RuntimeException("Invalid report reason");
        }
    }

    public com.fitnesssquare.model.Report reportPost(String postId, String reporterId, String reason) {
        validateReportReason(reason);

        if (reportRepository.existsByReporterIdAndTargetIdAndTargetType(reporterId, postId, "POST")) {
            throw new RuntimeException("You have already reported this post");
        }

        Optional<BlogPost> postOpt = blogRepository.findById(postId);
        if (postOpt.isPresent()) {
            BlogPost post = postOpt.get();
            if (post.getAuthorId().equals(reporterId)) {
                throw new RuntimeException("You cannot report your own post");
            }
            post.setReportCount(post.getReportCount() + 1);
            if (post.getReportCount() >= 5) {
                post.setStatus("FLAGGED_AUTO");
            }
            blogRepository.save(post);
        } else {
            throw new RuntimeException("Post not found");
        }

        com.fitnesssquare.model.Report report = new com.fitnesssquare.model.Report();
        report.setReporterId(reporterId);
        report.setTargetId(postId);
        report.setTargetType("POST");
        report.setReason(reason);
        report.setStatus("PENDING");
        report.setCreatedAt(LocalDateTime.now());

        return reportRepository.save(report);
    }

    public Comment addComment(Comment comment) {
        comment.setCreatedAt(LocalDateTime.now());
        return commentRepository.save(comment);
    }

    public List<Comment> getCommentsForPost(String postId) {
        return commentRepository.findByPostIdOrderByCreatedAtAsc(postId);
    }

    public BlogPost likePost(String postId, String userId) {
        Optional<BlogPost> postOpt = blogRepository.findById(id(postId));
        if (postOpt.isPresent()) {
            BlogPost post = postOpt.get();
            if (post.getLikes().contains(userId)) {
                post.getLikes().remove(userId);
            } else {
                post.getLikes().add(userId);
            }
            return blogRepository.save(post);
        }
        throw new RuntimeException("Post not found");
    }

    // Helper to fix potential id naming issue if any, but standard is just String
    private String id(String id) {
        return id;
    }

    public void deletePost(String id, String moderatorId) {
        Optional<BlogPost> postOpt = blogRepository.findById(id);
        if (postOpt.isPresent()) {
            BlogPost post = postOpt.get();
            String snippet = "Author: " + (post.getAuthorName() != null ? post.getAuthorName() : "Unknown")
                    + " | Content: " + (post.getTitle() != null ? post.getTitle() : "Untitled Post");
            logAction("POST_DELETED", moderatorId, id, snippet);
            blogRepository.deleteById(id);
            reportRepository.deleteByTargetId(id);
        }
    }

    public com.fitnesssquare.model.Report reportComment(String commentId, String postId, String reporterId,
            String reason) {
        validateReportReason(reason);

        if (reportRepository.existsByReporterIdAndTargetIdAndTargetType(reporterId, commentId, "COMMENT")) {
            throw new RuntimeException("You have already reported this comment");
        }

        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isPresent()) {
            Comment comment = commentOpt.get();
            if (comment.getUserId().equals(reporterId)) {
                throw new RuntimeException("You cannot report your own comment");
            }
            comment.setReportCount(comment.getReportCount() + 1);
            if (comment.getReportCount() >= 5) {
                comment.setStatus("FLAGGED_AUTO"); // or some hidden status
            }
            commentRepository.save(comment);
        } else {
            throw new RuntimeException("Comment not found");
        }

        com.fitnesssquare.model.Report report = new com.fitnesssquare.model.Report();
        report.setReporterId(reporterId);
        report.setTargetId(commentId);
        report.setTargetType("COMMENT");
        report.setReason(reason);
        report.setStatus("PENDING");
        report.setCreatedAt(LocalDateTime.now());

        return reportRepository.save(report);
    }

    public Comment updateCommentStatus(String commentId, String status, String moderatorId) {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isPresent()) {
            Comment comment = commentOpt.get();
            comment.setStatus(status);
            Comment saved = commentRepository.save(comment);

            String contentSnippet = comment.getContent();
            if (contentSnippet != null && contentSnippet.length() > 50)
                contentSnippet = contentSnippet.substring(0, 47) + "...";
            String snippet = "Author: " + (comment.getUserName() != null ? comment.getUserName() : "Unknown")
                    + " | Content: " + (contentSnippet != null ? contentSnippet : "No Content");
            logAction("COMMENT_" + status.toUpperCase(), moderatorId, saved.getId(), snippet);
            return saved;
        }
        throw new RuntimeException("Comment not found");
    }

    public Optional<Comment> getCommentById(String commentId) {
        return commentRepository.findById(commentId);
    }

    public void deleteComment(String commentId, String moderatorId) {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isPresent()) {
            Comment comment = commentOpt.get();
            String contentSnippet = comment.getContent();
            if (contentSnippet != null && contentSnippet.length() > 50)
                contentSnippet = contentSnippet.substring(0, 47) + "...";
            String snippet = "Author: " + (comment.getUserName() != null ? comment.getUserName() : "Unknown")
                    + " | Content: " + (contentSnippet != null ? contentSnippet : "No Content");
            logAction("COMMENT_DELETED", moderatorId, commentId, snippet);
            commentRepository.deleteById(commentId);
            reportRepository.deleteByTargetId(commentId);
        }
    }

    public List<ReportDTO> getAllReports() {
        List<com.fitnesssquare.model.Report> reports = reportRepository.findAll();
        return reports.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    public List<ReportDTO> getReportsByReporter(String reporterId) {
        List<com.fitnesssquare.model.Report> reports = reportRepository.findByReporterId(reporterId);
        return reports.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    public void withdrawReport(String reporterId, String targetId, String targetType) {
        reportRepository.findByReporterIdAndTargetIdAndTargetType(reporterId, targetId, targetType)
                .ifPresent(report -> {
                    reportRepository.delete(report);
                    // Optionally decrement report count on target content
                    if ("COMMENT".equals(targetType)) {
                        commentRepository.findById(targetId).ifPresent(c -> {
                            c.setReportCount(Math.max(0, c.getReportCount() - 1));
                            commentRepository.save(c);
                        });
                    }
                });
    }

    private ReportDTO convertToDTO(com.fitnesssquare.model.Report report) {
        ReportDTO dto = new ReportDTO();
        dto.setId(report.getId());
        dto.setTargetId(report.getTargetId());
        dto.setTargetType(report.getTargetType());
        dto.setReason(report.getReason());
        dto.setCreatedAt(report.getCreatedAt());

        String targetType = report.getTargetType();
        if (targetType == null || targetType.isEmpty()) {
            targetType = "POST";
            dto.setTargetType(targetType);
        }

        String targetId = report.getTargetId();

        // Reporter Details
        if (report.getReporterId() != null && !report.getReporterId().isEmpty()) {
            userRepository.findById(report.getReporterId()).ifPresentOrElse(user -> {
                dto.setReporterName(user.getFullname());
                dto.setReporterEmail(user.getEmail());
            }, () -> {
                dto.setReporterName("Unknown User");
                dto.setReporterEmail("");
            });
        }

        // Target Content Details
        if (targetId != null && !targetId.isEmpty()) {
            if ("POST".equals(targetType)) {
                blogRepository.findById(targetId).ifPresent(post -> {
                    dto.setTargetAuthorName(post.getAuthorName());
                    String snippet = post.getContent();
                    if (snippet != null && snippet.length() > 50) {
                        snippet = snippet.substring(0, 47) + "...";
                    }
                    dto.setTargetContentSnippet(snippet);
                });
            } else if ("COMMENT".equals(targetType)) {
                commentRepository.findById(targetId).ifPresent(comment -> {
                    dto.setTargetAuthorName(comment.getUserName());
                    String snippet = comment.getContent();
                    if (snippet != null && snippet.length() > 50) {
                        snippet = snippet.substring(0, 47) + "...";
                    }
                    dto.setTargetContentSnippet(snippet);
                });
            }
        }
        return dto;
    }

    public List<ModerationHistoryDTO> getModerationHistory() {
        List<AuditLog> logs = auditLogRepository.findAll();
        logs.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));

        return logs.stream()
                .filter(log -> !log.getActionType().equals("POST_AUTO_FLAGGED")) // Only manual actions
                .map(log -> {
                    ModerationHistoryDTO dto = new ModerationHistoryDTO();
                    dto.setId(log.getId());
                    dto.setActionType(log.getActionType());
                    dto.setTargetId(log.getTargetId());
                    dto.setTargetSnippet(log.getDetails());
                    dto.setTimestamp(log.getTimestamp());

                    if (log.getActionType().startsWith("POST_")) {
                        dto.setTargetType("POST");
                    } else if (log.getActionType().startsWith("COMMENT_")) {
                        dto.setTargetType("COMMENT");
                    } else {
                        dto.setTargetType("UNKNOWN");
                    }

                    if (log.getModeratorId() != null && !log.getModeratorId().equals("SYSTEM")) {
                        userRepository.findById(log.getModeratorId()).ifPresent(user -> {
                            dto.setModeratorName(user.getFullname());
                            dto.setModeratorRole(user.getRole());
                        });
                    } else {
                        dto.setModeratorName("System");
                        dto.setModeratorRole("SYSTEM");
                    }

                    return dto;
                }).collect(Collectors.toList());
    }
}
