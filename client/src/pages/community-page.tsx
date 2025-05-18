import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ForumPost, ForumComment } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, Heart, Eye, Users, Clock, ExternalLink } from "lucide-react";
import { SiDiscord, SiPatreon } from "react-icons/si";

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("forum");
  
  // Forum state
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState("general");
  const [commentContent, setCommentContent] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  
  // Fetch forum posts
  const { data: forumPosts, isLoading: isLoadingPosts } = useQuery<ForumPost[]>({
    queryKey: ['/api/forum/posts'],
    enabled: activeTab === "forum",
  });
  
  // Fetch comments for selected post
  const { data: postComments, isLoading: isLoadingComments } = useQuery<ForumComment[]>({
    queryKey: ['/api/forum/comments', selectedPostId],
    enabled: !!selectedPostId,
  });
  
  // Selected post
  const selectedPost = selectedPostId ? forumPosts?.find(post => post.id === selectedPostId) : null;
  
  // Create post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to create posts.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await apiRequest("POST", "/api/forum/posts", {
        title: postTitle,
        content: postContent,
        category: postCategory,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/forum/posts'] });
      
      setPostTitle("");
      setPostContent("");
      setPostCategory("general");
      
      toast({
        title: "Post created",
        description: "Your post has been published successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to create post",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };
  
  // Create comment
  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to leave comments.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedPostId) return;
    
    try {
      await apiRequest("POST", "/api/forum/comments", {
        postId: selectedPostId,
        content: commentContent,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/forum/comments', selectedPostId] });
      
      setCommentContent("");
      
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to add comment",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };
  
  // View post
  const handleViewPost = (postId: number) => {
    setSelectedPostId(postId);
  };
  
  // Back to forum list
  const handleBackToForum = () => {
    setSelectedPostId(null);
  };
  
  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12 cosmic-bg p-8 rounded-lg">
        <h1 className="text-4xl md:text-5xl font-alex-brush text-accent mb-4">SoulSeer Community</h1>
        <p className="text-light/80 font-playfair max-w-3xl mx-auto">
          Connect with like-minded individuals, share your spiritual experiences, and grow together in our vibrant community.
        </p>
      </div>
      
      {/* Main Content */}
      <Tabs defaultValue="forum" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-primary-dark/50">
          <TabsTrigger value="forum" className="font-cinzel">Forum</TabsTrigger>
          <TabsTrigger value="discord" className="font-cinzel">Discord</TabsTrigger>
          <TabsTrigger value="patreon" className="font-cinzel">Patreon</TabsTrigger>
        </TabsList>
        
        {/* Forum Tab */}
        <TabsContent value="forum" className="space-y-6">
          {selectedPostId ? (
            // Post detail view
            <div className="space-y-6">
              <CelestialButton 
                variant="secondary" 
                onClick={handleBackToForum}
                className="mb-4"
              >
                ← Back to Forum
              </CelestialButton>
              
              {selectedPost && (
                <Card className="glow-card bg-primary-dark/40 border-accent/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-cinzel text-accent text-2xl">{selectedPost.title}</CardTitle>
                      <span className="px-3 py-1 text-xs bg-accent/20 text-accent rounded-full font-cinzel">
                        {selectedPost.category}
                      </span>
                    </div>
                    <CardDescription className="text-light/70">
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1 text-accent/60" />
                          User #{selectedPost.userId}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-accent/60" />
                          {selectedPost.createdAt ? new Date(selectedPost.createdAt).toLocaleDateString() : 'Unknown date'}
                        </span>
                        <span className="flex items-center">
                          <Heart className="h-4 w-4 mr-1 text-accent/60" />
                          {selectedPost.likes}
                        </span>
                        <span className="flex items-center">
                          <Eye className="h-4 w-4 mr-1 text-accent/60" />
                          {selectedPost.views}
                        </span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none font-playfair">
                      <p className="text-light/90 whitespace-pre-line">{selectedPost.content}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Comments section */}
              <div>
                <h3 className="text-xl font-cinzel text-accent mb-4">Comments</h3>
                
                {isLoadingComments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-light/70">Loading comments...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {postComments && postComments.length > 0 ? (
                      postComments.map(comment => (
                        <Card key={comment.id} className="bg-primary-dark/20 border-accent/10">
                          <CardHeader className="py-3">
                            <CardDescription className="text-light/70">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center">
                                  <Users className="h-4 w-4 mr-1 text-accent/60" />
                                  User #{comment.userId}
                                </span>
                                <span className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1 text-accent/60" />
                                  {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Unknown date'}
                                </span>
                              </div>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="py-2">
                            <p className="text-light/80 whitespace-pre-line">{comment.content}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-light/50 py-4">No comments yet. Be the first to comment!</p>
                    )}
                    
                    {/* Add comment form */}
                    <form onSubmit={handleCreateComment} className="mt-6">
                      <h4 className="text-lg font-cinzel text-accent mb-2">Add a Comment</h4>
                      <Textarea
                        placeholder="Share your thoughts..."
                        value={commentContent}
                        onChange={e => setCommentContent(e.target.value)}
                        className="bg-primary-dark/30 border-accent/20 text-light mb-3"
                        required
                      />
                      <CelestialButton variant="primary" type="submit" disabled={!user}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Post Comment
                      </CelestialButton>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Forum list view
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <h2 className="text-2xl font-cinzel text-accent mb-4">Recent Discussions</h2>
                
                {isLoadingPosts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-light/70">Loading forum posts...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {forumPosts && forumPosts.length > 0 ? (
                      forumPosts.map(post => (
                        <Card 
                          key={post.id} 
                          className="glow-card bg-primary-dark/40 border-accent/20 hover:border-accent/40 transition-all cursor-pointer"
                          onClick={() => handleViewPost(post.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="font-cinzel text-accent text-xl">{post.title}</CardTitle>
                              <span className="px-3 py-1 text-xs bg-accent/20 text-accent rounded-full font-cinzel">
                                {post.category}
                              </span>
                            </div>
                            <CardDescription className="text-light/70">
                              <div className="flex items-center space-x-4 mt-2">
                                <span className="flex items-center">
                                  <Users className="h-4 w-4 mr-1 text-accent/60" />
                                  User #{post.userId}
                                </span>
                                <span className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1 text-accent/60" />
                                  {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown date'}
                                </span>
                                <span className="flex items-center">
                                  <Heart className="h-4 w-4 mr-1 text-accent/60" />
                                  {post.likes}
                                </span>
                                <span className="flex items-center">
                                  <Eye className="h-4 w-4 mr-1 text-accent/60" />
                                  {post.views}
                                </span>
                              </div>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <p className="text-light/80 line-clamp-2">{post.content}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-light/50 py-8">No forum posts yet. Be the first to start a discussion!</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Create Post Form */}
              <div>
                <Card className="glow-card bg-primary-dark/40 border-accent/20">
                  <CardHeader>
                    <CardTitle className="font-cinzel text-accent">Start a Discussion</CardTitle>
                    <CardDescription className="text-light/70">
                      Share your thoughts, ask questions, or discuss spiritual topics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreatePost} className="space-y-4">
                      <div>
                        <label htmlFor="title" className="block text-sm font-cinzel text-light/80 mb-1">
                          Title
                        </label>
                        <Input
                          id="title"
                          placeholder="Enter a title for your post"
                          value={postTitle}
                          onChange={e => setPostTitle(e.target.value)}
                          className="bg-primary-dark/30 border-accent/20 text-light"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="category" className="block text-sm font-cinzel text-light/80 mb-1">
                          Category
                        </label>
                        <select
                          id="category"
                          value={postCategory}
                          onChange={e => setPostCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-primary-dark/30 border border-accent/20 text-light rounded-md focus:outline-none focus:ring-2 focus:ring-accent/40"
                          required
                        >
                          <option value="general">General</option>
                          <option value="readings">Readings</option>
                          <option value="spiritual">Spiritual</option>
                          <option value="products">Products</option>
                          <option value="guidance">Guidance</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="content" className="block text-sm font-cinzel text-light/80 mb-1">
                          Content
                        </label>
                        <Textarea
                          id="content"
                          placeholder="Share your thoughts..."
                          value={postContent}
                          onChange={e => setPostContent(e.target.value)}
                          className="bg-primary-dark/30 border-accent/20 text-light min-h-[200px]"
                          required
                        />
                      </div>
                      
                      <CelestialButton variant="primary" type="submit" className="w-full" disabled={!user}>
                        Create Post
                      </CelestialButton>
                      
                      {!user && (
                        <p className="text-center text-xs text-light/50 mt-2">
                          You need to be logged in to create a post.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Discord Tab */}
        <TabsContent value="discord">
          <Card className="glow-card overflow-hidden bg-primary-dark/40 border-accent/20">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/2 p-6 md:p-10 flex flex-col justify-center">
                <div className="text-center md:text-left">
                  <SiDiscord className="h-16 w-16 text-[#5865F2] mx-auto md:mx-0 mb-4" />
                  <h2 className="text-3xl font-cinzel text-accent mb-4">Join Our Discord Community</h2>
                  <p className="text-light/80 font-playfair mb-6 max-w-lg">
                    Connect with like-minded individuals, receive instant updates, and participate in exclusive voice channels and live events with our readers.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="bg-accent/20 p-2 rounded-full">
                        <Users className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-cinzel text-light">Connect with Members</h3>
                        <p className="text-light/70 text-sm">Engage with our vibrant community of spiritual seekers</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="bg-accent/20 p-2 rounded-full">
                        <MessageSquare className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-cinzel text-light">Live Discussions</h3>
                        <p className="text-light/70 text-sm">Participate in voice channels and text discussions</p>
                      </div>
                    </div>
                  </div>
                  
                  <a 
                    href="https://discord.gg/Wbue7BGUe5" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-8 inline-block"
                  >
                    <CelestialButton variant="primary" className="group">
                      <SiDiscord className="mr-2 h-5 w-5" />
                      Join Discord Server
                      <ExternalLink className="ml-2 h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </CelestialButton>
                  </a>
                </div>
              </div>
              <div className="md:w-1/2 bg-[#5865F2]/10">
                <div className="p-6 md:p-10 h-full flex items-center justify-center">
                  <div className="max-w-md w-full bg-[#36393F] rounded-lg shadow-xl overflow-hidden">
                    <div className="bg-[#2F3136] p-4">
                      <div className="flex items-center space-x-2">
                        <SiDiscord className="h-6 w-6 text-white" />
                        <h3 className="text-white font-medium">SoulSeer Community</h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-4">
                        <div className="bg-[#32353B] p-3 rounded">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">S</div>
                            <div>
                              <p className="text-[#dcddde] text-sm font-medium">SoulSeer</p>
                              <p className="text-[#b9bbbe] text-xs">Welcome to our spiritual community!</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-[#32353B] p-3 rounded">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">U</div>
                            <div>
                              <p className="text-[#dcddde] text-sm font-medium">User</p>
                              <p className="text-[#b9bbbe] text-xs">How do I join a reading session?</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-[#32353B] p-3 rounded">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">R</div>
                            <div>
                              <p className="text-[#dcddde] text-sm font-medium">Reader</p>
                              <p className="text-[#b9bbbe] text-xs">I'll be hosting a group session tonight at 8pm!</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        {/* Patreon Tab */}
        <TabsContent value="patreon">
          <Card className="glow-card overflow-hidden bg-primary-dark/40 border-accent/20">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/2 p-6 md:p-10 flex flex-col justify-center">
                <div className="text-center md:text-left">
                  <SiPatreon className="h-16 w-16 text-[#F96854] mx-auto md:mx-0 mb-4" />
                  <h2 className="text-3xl font-cinzel text-accent mb-4">Support Us on Patreon</h2>
                  <p className="text-light/80 font-playfair mb-6 max-w-lg">
                    Become a patron and unlock exclusive content, personalized readings, and special perks while supporting our spiritual mission.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="bg-accent/20 p-2 rounded-full">
                        <Heart className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-cinzel text-light">Exclusive Content</h3>
                        <p className="text-light/70 text-sm">Access private readings, spiritual guides, and personalized content</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="bg-accent/20 p-2 rounded-full">
                        <Users className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-cinzel text-light">Direct Access</h3>
                        <p className="text-light/70 text-sm">Connect directly with our top readers for guidance</p>
                      </div>
                    </div>
                  </div>
                  
                  <a 
                    href="https://patreon.com/SoulSeer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-8 inline-block"
                  >
                    <CelestialButton variant="primary" className="group">
                      <SiPatreon className="mr-2 h-5 w-5" />
                      Become a Patron
                      <ExternalLink className="ml-2 h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </CelestialButton>
                  </a>
                </div>
              </div>
              <div className="md:w-1/2 bg-[#F96854]/10">
                <div className="p-6 md:p-10 h-full flex items-center justify-center">
                  <div className="max-w-md w-full rounded-lg shadow-xl overflow-hidden">
                    <div className="bg-white p-6 space-y-4">
                      <div className="border-b border-gray-200 pb-4">
                        <h3 className="text-xl font-bold text-gray-800">Patron Tiers</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg">
                          <h4 className="text-lg font-semibold text-purple-800">Cosmic Explorer</h4>
                          <p className="text-purple-600 font-bold">$5 / month</p>
                          <ul className="mt-2 space-y-1 text-sm text-gray-600">
                            <li>• Access to patron-only posts</li>
                            <li>• Monthly spiritual guidance newsletter</li>
                            <li>• Exclusive meditation audio recordings</li>
                          </ul>
                        </div>
                        
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                          <h4 className="text-lg font-semibold text-blue-800">Celestial Journeyer</h4>
                          <p className="text-blue-600 font-bold">$15 / month</p>
                          <ul className="mt-2 space-y-1 text-sm text-gray-600">
                            <li>• All previous tier benefits</li>
                            <li>• Monthly group reading session</li>
                            <li>• 10% discount on all shop products</li>
                            <li>• Early access to new features</li>
                          </ul>
                        </div>
                        
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-lg border border-yellow-100">
                          <div className="absolute -mt-6 -mr-4 right-0">
                            <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">POPULAR</span>
                          </div>
                          <h4 className="text-lg font-semibold text-amber-800">Soul Guardian</h4>
                          <p className="text-amber-600 font-bold">$30 / month</p>
                          <ul className="mt-2 space-y-1 text-sm text-gray-600">
                            <li>• All previous tier benefits</li>
                            <li>• Monthly private reading (30 min)</li>
                            <li>• VIP access to all livestream events</li>
                            <li>• Personalized spiritual growth plan</li>
                            <li>• 20% discount on all shop products</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}