package com.fitnesssquare.controller;

import com.fitnesssquare.model.BlogPost;
import com.fitnesssquare.model.Comment;
import com.fitnesssquare.model.User;
import com.fitnesssquare.dto.ReportDTO;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.security.JwtUtils;
import com.fitnesssquare.service.BlogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/blog")
public class BlogController {

    @Autowired
    private BlogService blogService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    // Create a new post
    // Create a new post with image upload
    @PostMapping("/create")
    public ResponseEntity<?> createPost(@RequestHeader("Authorization") String authHeader,
            @RequestParam("title") String title,
            @RequestParam("content") String content,
            @RequestParam(value = "tags", required = false) List<String> tags,
            @RequestParam(value = "image", required = false) org.springframework.web.multipart.MultipartFile image) {
        try {
            User user = getAuthenticatedUser(authHeader);
            BlogPost post = new BlogPost();
            post.setTitle(title);
            post.setContent(content);
            post.setTags(tags);
            post.setAuthorId(user.getId());
            post.setAuthorName(user.getFullname());
            post.setAuthorRole(user.getRole());
            post.setCreatedAt(LocalDateTime.now());
            post.setUpdatedAt(LocalDateTime.now());

            // Handle Image Upload
            if (image != null && !image.isEmpty()) {
                String uploadDir = "uploads";
                java.nio.file.Path uploadPath = java.nio.file.Paths.get(uploadDir);
                if (!java.nio.file.Files.exists(uploadPath)) {
                    java.nio.file.Files.createDirectories(uploadPath);
                }

                String fileName = System.currentTimeMillis() + "_" + image.getOriginalFilename();
                java.nio.file.Path filePath = uploadPath.resolve(fileName);
                java.nio.file.Files.copy(image.getInputStream(), filePath,
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING);

                // Set the URL to access the image
                // Assuming app runs on localhost:8080, image will be at /uploads/filename
                // In production, this might need a full URL or relative path handling
                post.setImageUrl("/uploads/" + fileName);
            }

            if ("admin".equalsIgnoreCase(user.getRole())) {
                post.setStatus("PUBLISHED");
            } else {
                post.setStatus("PENDING");
            }

            BlogPost createdPost = blogService.createPost(post);
            return ResponseEntity.ok(createdPost);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error creating post: " + e.getMessage());
        }
    }

    // Get all published posts (For main feed)
    @GetMapping("/published")
    public ResponseEntity<?> getAllPublishedPosts() {
        return ResponseEntity.ok(blogService.getAllPublishedPosts());
    }

    // Get pending posts (For moderation: Admin/Trainer only)
    @GetMapping("/pending")
    public ResponseEntity<?> getPendingPosts(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (!"admin".equalsIgnoreCase(user.getRole()) && !"trainer".equalsIgnoreCase(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }

        // Fetch both purely pending posts and those auto-flagged by the system
        List<BlogPost> pending = blogService.getPendingPosts();

        // Filter out trainer posts if the reviewer is a trainer
        if ("trainer".equalsIgnoreCase(user.getRole())) {
            pending = pending.stream()
                    .filter(post -> !("trainer".equalsIgnoreCase(post.getAuthorRole())))
                    .collect(java.util.stream.Collectors.toList());
        }

        return ResponseEntity.ok(pending);
    }

    // Get My Posts
    @GetMapping("/my-posts")
    public ResponseEntity<?> getMyPosts(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(blogService.getMyPosts(user.getId()));
    }

    // Toggle Archive Post
    @PutMapping("/{id}/archive")
    public ResponseEntity<?> toggleArchivePost(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, Boolean> body) {
        try {
            User user = getAuthenticatedUser(authHeader);
            Boolean archive = body.get("archive");
            if (archive == null)
                return ResponseEntity.badRequest().body("Archive status is required.");
            return ResponseEntity.ok(blogService.archivePost(id, user.getId(), archive));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // Get Archived Posts
    @GetMapping("/archived")
    public ResponseEntity<?> getArchivedPosts(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(blogService.getArchivedPosts(user.getId()));
    }

    // Toggle Save Post
    @PutMapping("/{id}/save")
    public ResponseEntity<?> toggleSavePost(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        try {
            User user = getAuthenticatedUser(authHeader);
            return ResponseEntity.ok(blogService.toggleSavePost(id, user.getId()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // Get Saved Posts
    @GetMapping("/saved")
    public ResponseEntity<?> getSavedPosts(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(blogService.getSavedPosts(user.getId()));
    }

    // Get Reported Posts
    @GetMapping("/reported")
    public ResponseEntity<?> getReportedPosts(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(blogService.getReportedPostsByUser(user.getId()));
    }

    // Update post status (Moderation)
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authHeader);
        if (!"admin".equalsIgnoreCase(user.getRole()) && !"trainer".equalsIgnoreCase(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }

        // Prevent trainers from approving posts created by other trainers
        if ("trainer".equalsIgnoreCase(user.getRole())) {
            BlogPost post = blogService.getPostById(id).orElse(null);
            if (post != null && "trainer".equalsIgnoreCase(post.getAuthorRole())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                        "Trainers cannot approve or reject posts created by other trainers. Only admins are allowed.");
            }
        }

        String status = body.get("status"); // PUBLISHED, REJECTED
        return ResponseEntity.ok(blogService.updatePostStatus(id, status, user.getId()));
    }

    // Add comment
    @PostMapping("/{id}/comment")
    public ResponseEntity<?> addComment(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Comment comment) {
        User user = getAuthenticatedUser(authHeader);
        comment.setPostId(id);
        comment.setUserId(user.getId());
        comment.setUserName(user.getFullname());

        return ResponseEntity.ok(blogService.addComment(comment));
    }

    // Report comment
    @PostMapping("/{postId}/comments/{commentId}/report")
    public ResponseEntity<?> reportComment(@RequestHeader("Authorization") String authHeader,
            @PathVariable String postId,
            @PathVariable String commentId,
            @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authHeader);
        String reason = body.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Reason for report is required.");
        }
        return ResponseEntity.ok(blogService.reportComment(commentId, postId, user.getId(), reason));
    }

    // Update comment status (Moderation)
    @PutMapping("/comments/{commentId}/status")
    public ResponseEntity<?> updateCommentStatus(@RequestHeader("Authorization") String authHeader,
            @PathVariable String commentId,
            @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authHeader);
        if (!"admin".equalsIgnoreCase(user.getRole()) && !"trainer".equalsIgnoreCase(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }
        String status = body.get("status"); // REJECTED (hidden) or PUBLISHED
        return ResponseEntity.ok(blogService.updateCommentStatus(commentId, status, user.getId()));
    }

    // Get comments for a post
    @GetMapping("/{id}/comments")
    public ResponseEntity<?> getComments(@PathVariable String id) {
        return ResponseEntity.ok(blogService.getCommentsForPost(id));
    }

    // Like/Unlike post
    @PutMapping("/{id}/like")
    public ResponseEntity<?> likePost(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        User user = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(blogService.likePost(id, user.getId()));
    }

    // Report post
    @PostMapping("/{id}/report")
    public ResponseEntity<?> reportPost(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authHeader);
        String reason = body.get("reason");
        return ResponseEntity.ok(blogService.reportPost(id, user.getId(), reason));
    }

    // Get all reports (Moderation)
    @GetMapping("/reports")
    public ResponseEntity<?> getReports(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (!"admin".equalsIgnoreCase(user.getRole()) && !"trainer".equalsIgnoreCase(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }
        return ResponseEntity.ok(blogService.getAllReports());
    }

    // Get moderation history
    @GetMapping("/history")
    public ResponseEntity<?> getModerationHistory(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (!"admin".equalsIgnoreCase(user.getRole()) && !"trainer".equalsIgnoreCase(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }
        return ResponseEntity.ok(blogService.getModerationHistory());
    }

    // Delete post
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePost(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        User user = getAuthenticatedUser(authHeader);
        BlogPost post = blogService.getPostById(id).orElse(null);
        if (post == null)
            return ResponseEntity.notFound().build();

        // Allow deletion if Admin or Author or Trainer
        boolean isAuthor = post.getAuthorId().equals(user.getId());
        boolean isAdmin = "admin".equalsIgnoreCase(user.getRole());
        boolean isTrainer = "trainer".equalsIgnoreCase(user.getRole());

        if (!isAuthor && !isAdmin && !isTrainer) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }

        blogService.deletePost(id, user.getId());
        return ResponseEntity.ok(Map.of("message", "Post deleted successfully"));
    }

    // Delete comment
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@RequestHeader("Authorization") String authHeader,
            @PathVariable String commentId) {
        User user = getAuthenticatedUser(authHeader);
        Comment comment = blogService.getCommentById(commentId).orElse(null);
        if (comment == null) {
            return ResponseEntity.notFound().build();
        }

        boolean isAuthor = comment.getUserId().equals(user.getId());
        boolean isAdmin = "admin".equalsIgnoreCase(user.getRole());
        boolean isTrainer = "trainer".equalsIgnoreCase(user.getRole());

        if (!isAuthor && !isAdmin && !isTrainer) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }

        blogService.deleteComment(commentId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Comment deleted successfully"));
    }

    // Get personal report history
    @GetMapping("/reports/me")
    public ResponseEntity<List<ReportDTO>> getMyReports(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(blogService.getReportsByReporter(user.getId()));
    }

    // Withdraw a report
    @DeleteMapping("/reports/withdraw/{targetId}/{targetType}")
    public ResponseEntity<?> withdrawReport(@RequestHeader("Authorization") String authHeader,
            @PathVariable String targetId, @PathVariable String targetType) {
        User user = getAuthenticatedUser(authHeader);
        blogService.withdrawReport(user.getId(), targetId, targetType);
        return ResponseEntity.ok(Map.of("message", "Report withdrawn successfully"));
    }

    // Get single post details
    @GetMapping("/{id}")
    public ResponseEntity<?> getPost(@PathVariable String id) {
        return blogService.getPostById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtils.getEmailFromToken(token);
        String role = (String) jwtUtils.getClaims(token).get("role");
        return userRepository.findByEmailAndRole(email, role)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
