import React from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Plus, Monitor, Coffee } from 'lucide-react';
import { PageHeader, TabItem } from '../components/PageHeader';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { BlogPostModal } from '../components/BlogPostModal';
import { BlogCard } from '../components/BlogCard';
import { LikeButton } from '../components/LikeButton';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { API_URL } from '../utils/apiConfig';
import { Pagination } from '../components/Pagination';
import { BlogLayout } from '../components/BlogLayout';
import { BlogGrid } from '../components/BlogGrid';
import { fetchMemberRole, getStoredUserProfile, subscribeToUserProfileChanges } from '../utils/auth';

const COOKING_TEMPLATE = `# 

### 🥔 Ingredients
* 

### 👨‍🍳 Instructions
* **Step 1**: 
* **Step 2**: 
* **Step 3**: 
* **Step 4**: 
* **Step 5**: `;

export const Blog: React.FC = () => {
    const location = useLocation();
    const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
    const [blogPosts, setBlogPosts] = React.useState<any[]>([]);
    const [user, setUser] = React.useState<any>(null);
    const [isAuthorized, setIsAuthorized] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [showToast, setShowToast] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState('');
    const [toastPos, setToastPos] = React.useState({ x: 0, y: 0 });
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [editData, setEditData] = React.useState({ category: '', title: '', content: '', tags: '', existingImages: [] as string[] });
    const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
    const [showPublishDialog, setShowPublishDialog] = React.useState(false);
    const [isCreateMode, setIsCreateMode] = React.useState(false);
    const [showValidationDialog, setShowValidationDialog] = React.useState(false);
    const [uploadingImage, setUploadingImage] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);

    // Unified Color Theme: All Pink
    const colorThemes = React.useMemo(() => [
        { color: "bg-pink-50", textColor: "text-pink-700", borderColor: "border-pink-100", hoverBorderColor: "hover:border-pink-200", hoverColor: "group-hover:text-pink-600" },
        { color: "bg-pink-50", textColor: "text-pink-700", borderColor: "border-pink-100", hoverBorderColor: "hover:border-pink-200", hoverColor: "group-hover:text-pink-600" },
        { color: "bg-pink-50", textColor: "text-pink-700", borderColor: "border-pink-100", hoverBorderColor: "hover:border-pink-200", hoverColor: "group-hover:text-pink-600" },
        { color: "bg-pink-50", textColor: "text-pink-700", borderColor: "border-pink-100", hoverBorderColor: "hover:border-pink-200", hoverColor: "group-hover:text-pink-600" },
    ], []);

    // Combine blog posts with themes
    const allPosts = React.useMemo(() => blogPosts.map((post, i) => ({
        ...post,
        ...colorThemes[i % colorThemes.length],
        originalIndex: i
    })), [blogPosts, colorThemes]);

    // Markdown components - memoized to prevent re-renders
    const markdownComponents = React.useMemo(() => ({
        // Headings
        h1: ({ node, ...props }: any) => <h1 className="text-3xl font-bold mb-4 mt-6 text-slate-900" {...props} />,
        h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold mb-3 mt-5 text-slate-900 border-b pb-2" {...props} />,
        h3: ({ node, ...props }: any) => <h3 className="text-xl font-bold mb-2 mt-4 text-slate-900" {...props} />,
        h4: ({ node, ...props }: any) => <h4 className="text-lg font-bold mb-2 mt-3 text-slate-900" {...props} />,
        h5: ({ node, ...props }: any) => <h5 className="text-base font-bold mb-2 mt-3 text-slate-900" {...props} />,
        h6: ({ node, ...props }: any) => <h6 className="text-sm font-bold mb-2 mt-3 text-slate-900" {...props} />,
        // Paragraphs
        p: ({ node, ...props }: any) => <p className="mb-4 leading-7" {...props} />,
        // Lists
        ul: ({ node, ...props }: any) => <ul className="list-disc list-outside mb-4 ml-6 space-y-2" {...props} />,
        ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside mb-4 ml-4 space-y-2" {...props} />,
        li: ({ node, ...props }: any) => <li className="leading-7" {...props} />,
        // Links
        a: ({ node, ...props }: any) => <a className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer" {...props} />,
        // Code
        code: ({ node, inline, ...props }: any) =>
            inline
                ? <code className="bg-slate-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                : <code className="block bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4" {...props} />,
        pre: ({ node, ...props }: any) => <pre className="mb-4" {...props} />,
        // Blockquotes
        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-slate-300 pl-4 italic my-4 text-slate-600" {...props} />,
        // Horizontal rule
        hr: ({ node, ...props }: any) => <hr className="my-6 border-slate-300" {...props} />,
        // Tables
        table: ({ node, ...props }: any) => <table className="min-w-full border-collapse border border-slate-300 mb-4" {...props} />,
        thead: ({ node, ...props }: any) => <thead className="bg-slate-100" {...props} />,
        tbody: ({ node, ...props }: any) => <tbody {...props} />,
        tr: ({ node, ...props }: any) => <tr className="border-b border-slate-300" {...props} />,
        th: ({ node, ...props }: any) => <th className="border border-slate-300 px-4 py-2 text-left font-bold" {...props} />,
        td: ({ node, ...props }: any) => <td className="border border-slate-300 px-4 py-2" {...props} />,
        // Images
        img: ({ node, ...props }: any) => (
            <span className="block my-4">
                <img
                    className="max-w-full h-auto rounded-lg bg-slate-50 min-h-[200px] object-contain mx-auto border border-slate-100"
                    loading="lazy"
                    decoding="async"
                    {...props}
                />
            </span>
        ),
        // Strong and emphasis
        strong: ({ node, ...props }: any) => <strong className="font-bold text-slate-900" {...props} />,
        em: ({ node, ...props }: any) => <em className="italic" {...props} />,
    }), []);

    const [currentPage, setCurrentPage] = React.useState(1);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearching, setIsSearching] = React.useState(false);

    // Routing for tabs
    const { tab } = useParams<{ tab: string }>();
    const navigate = useNavigate();
    const activeTab = tab || 'tech-bio';

    const tabs: TabItem[] = [
        { id: 'tech-bio', label: 'Tech & Bio', icon: Monitor },
        { id: 'life', label: 'Life', icon: Coffee }
    ];
    const postsPerPage = 4;

    React.useEffect(() => {
        // Fetch blog posts
        const fetchBlogs = async () => {
            try {
                console.log('Fetching from:', `${API_URL}/api/tech-blog`);
                const response = await fetch(`${API_URL}/api/tech-blog`);
                console.log('Response status:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('Fetched blog posts:', data);
                    console.log('Number of posts:', data.length);
                    setBlogPosts(data);
                } else {
                    console.error('Failed to fetch:', response.statusText);
                }
            } catch (error) {
                console.error('Failed to fetch blog posts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBlogs();

        // Get user data from localStorage (set by Google OAuth)
        const checkAuth = async () => {
            const userData = getStoredUserProfile<any>();
            if (userData) {
                try {
                    const newUser = {
                        ...userData,
                        userId: userData.sub || userData.id || userData.email
                    };

                    // Only update state if different
                    setUser((prev: any) => {
                        if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
                        return newUser;
                    });

                    // Check authorization from MEMBER collection
                    const data = await fetchMemberRole(userData.email);
                    setIsAuthorized(Boolean(data.authorized));
                } catch (e) {
                    console.error('Failed to parse user data or check authorization', e);
                    setIsAuthorized(false);
                }
            } else {
                setUser(null);
                setIsAuthorized(false);
            }
        };

        // Initial check
        checkAuth();

        const unsubscribe = subscribeToUserProfileChanges(checkAuth);

        return () => {
            unsubscribe();
        };
    }, []);

    // ESC key listener for modal
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedPostId !== null) {
                e.preventDefault();
                setSelectedPostId(null);
            }
        };

        if (selectedPostId !== null) {
            window.addEventListener('keydown', handleEsc);
            return () => window.removeEventListener('keydown', handleEsc);
        }
    }, [selectedPostId]);

    // Derived selected post object
    const selectedPost = React.useMemo(() =>
        allPosts.find(p => p._id === selectedPostId) || null,
        [allPosts, selectedPostId]);

    useLockBodyScroll(selectedPostId !== null && !isEditMode);

    // Handle like/unlike
    const handleLike = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!user) {
            setToastMessage('Login required to like posts');
            setToastPos({ x: e.clientX, y: e.clientY });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
            return;
        }

        try {


            const response = await fetch(`${API_URL}/api/tech-blog/${postId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Update local state
                setBlogPosts(prev => prev.map(post =>
                    post._id === postId
                        ? { ...post, likes: data.likes, likedBy: data.likedBy }
                        : post
                ));
            }
        } catch (error) {
            console.error('Failed to like post:', error);
        }
    };

    // Check if current user liked a post
    const isLikedByUser = (post: any) => {
        // Heart color is determined by likes count only
        return (post.likes || 0) > 0;
    };

    // Check if current user has already liked (for toggle logic)
    const hasUserLiked = (post: any) => {
        if (!user || !post.likedBy || !Array.isArray(post.likedBy)) return false;
        return post.likedBy.includes(user.email);
    };

    // Check if current user is the author
    const isAuthor = (post: any) => {
        return user && post.author?.email && user.email === post.author.email;
    };

    // Handle edit button click
    const handleEdit = () => {
        if (selectedPost) {
            const content = selectedPost.content || '';
            // Extract existing images from markdown content
            const imageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g;
            const existingImages: string[] = [];
            let match: RegExpExecArray | null;
            while ((match = imageRegex.exec(content)) !== null) {
                existingImages.push(match[1]);
            }

            setEditData({
                category: selectedPost.category || '',
                title: selectedPost.title || '',
                content: content,
                tags: selectedPost.tags ? selectedPost.tags.join('; ') : '',
                existingImages: existingImages
            });
            setIsEditMode(true);
        }
    };

    // Handle save
    const handleSave = async () => {
        if (!selectedPost) return;

        try {


            const tagsArray = editData.tags.split(';').map(t => t.trim()).filter(t => t);
            console.log('[FRONTEND] Sending UPDATE with tags:', tagsArray);

            const response = await fetch(`${API_URL}/api/tech-blog/${selectedPost._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editData,
                    tags: tagsArray,
                    email: user.email
                })
            });

            if (response.ok) {
                const updatedPost = await response.json();
                // Update local state
                setBlogPosts(prev => prev.map(post =>
                    post._id === updatedPost._id ? updatedPost : post
                ));
                setIsEditMode(false);
                // Keep selectedPostId to stay on detail page
            }
        } catch (error) {
            console.error('Failed to update post:', error);
        }
    };

    // Handle close edit (show discard dialog)
    const handleCloseEdit = () => {
        setShowDiscardDialog(true);
    };

    // Handle discard
    const handleDiscard = () => {
        setIsEditMode(false);
        setShowDiscardDialog(false);
        setSelectedPostId(null);
    };

    // Handle continue editing
    const handleContinueEdit = () => {
        setShowDiscardDialog(false);
    };

    // Handle delete button click
    const handleDelete = () => {
        setShowDeleteDialog(true);
    };

    // Handle confirm delete
    const handleConfirmDelete = async () => {
        if (!selectedPost) return;

        try {
            const response = await fetch(`${API_URL}/api/tech-blog/${selectedPost._id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email
                })
            });

            if (response.ok) {
                // Soft delete: update local state to show='D' (matches server behavior)
                setBlogPosts(prev => prev.map(post =>
                    post._id === selectedPost._id ? { ...post, show: 'D' } : post
                ));
                setShowDeleteDialog(false);
                setSelectedPostId(null);
            }
        } catch (error) {
            // ... already caught
        }
    };

    // Handle publish
    // Handle publish
    const handlePublishClick = () => {
        setShowPublishDialog(true);
    };

    const handleConfirmPublish = async () => {
        if (!selectedPost) return;
        const postId = selectedPost._id;

        try {
            const response = await fetch(`${API_URL}/api/tech-blog/${postId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPublished: true,
                    show: 'Y',
                    email: user.email
                })
            });

            if (response.ok) {
                const updatedPost = await response.json();
                // Update local state
                setBlogPosts(prev => prev.map(post =>
                    post._id === updatedPost._id ? updatedPost : post
                ));
                setToastMessage('Post published successfully!');
                setToastPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                setShowToast(true);
                setShowPublishDialog(false);
                setSelectedPostId(null); // Close modal
                setTimeout(() => {
                    setShowToast(false);
                    // Redirect to /blog/tech-bio
                    navigate('/blog/tech-bio');
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to publish post:', error);
        }
    };

    // Handle cancel delete
    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
        setSelectedPostId(null);
    };

    // Check if user can create posts
    const canCreatePost = () => {
        return user && isAuthorized;
    };

    // Handle create button click
    const handleCreate = () => {
        if (activeTab === 'life') {
            setEditData({
                category: 'Cooking',
                title: '',
                content: COOKING_TEMPLATE,
                tags: '',
                existingImages: []
            });
        } else {
            setEditData({ category: '', title: '', content: '', tags: '', existingImages: [] });
        }
        setIsCreateMode(true);
    };

    // Handle create save
    const handleCreateSave = async () => {
        // Validation check
        if (!editData.category.trim() || !editData.title.trim() || !editData.content.trim()) {
            setShowValidationDialog(true);
            return;
        }

        try {

            // Normal save
            const tagsArray = editData.tags.split(';').map(t => t.trim()).filter(t => t);
            console.log('[FRONTEND] Sending CREATE with tags:', tagsArray);

            const response = await fetch(`${API_URL}/api/tech-blog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editData,
                    tags: tagsArray,
                    isAutomated: false,
                    isPublished: true,
                    show: 'Y',
                    author: {
                        name: user.name,
                        email: user.email,
                        avatar: user.picture
                    }
                })
            });

            if (response.ok) {
                const newPost = await response.json();
                // Add to local state
                setBlogPosts(prev => [newPost, ...prev]);
                setIsCreateMode(false);
                setEditData({ category: '', title: '', content: '', tags: '', existingImages: [] });
            }
        } catch (error) {
            console.error('Failed to create post:', error);
            alert('Failed to save post. Please try again.');
        }
    };

    // Handle create cancel
    const handleCreateCancel = () => {
        // Check if any field has content
        const hasContent = editData.category.trim() || editData.title.trim() || editData.content.trim();

        if (hasContent) {
            setShowDiscardDialog(true);
        } else {
            // No content, just close
            setIsCreateMode(false);
            setEditData({ category: '', title: '', content: '', tags: '', existingImages: [] });
        }
    };

    // Handle discard create
    const handleDiscardCreate = () => {
        setIsCreateMode(false);
        setShowDiscardDialog(false);
        setEditData({ category: '', title: '', content: '', tags: '', existingImages: [] });
    };

    // Handle tag input with auto-formatting
    const handleTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.endsWith(' ') && !val.endsWith('; ')) {
            setEditData({ ...editData, tags: val.trim() + '; ' });
        } else {
            setEditData({ ...editData, tags: val });
        }
    };

    // Handle tag input blur to remove trailing semicolon
    const handleTagBlur = () => {
        let val = editData.tags.trim();
        if (val.endsWith(';')) {
            val = val.slice(0, -1);
        }
        setEditData({ ...editData, tags: val });
    };

    // Handle image upload
    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        setUploadingImage(true);
        try {


            const formData = new FormData();
            formData.append('image', file);
            // Add category for server-side path determination
            formData.append('category', editData.category);

            const response = await fetch(`${API_URL}/api/tech-blog/upload-image`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                // Insert markdown image syntax at the beginning of content (after title)
                const imageMarkdown = `![${file.name}](${data.url})\n\n`;
                setEditData({
                    ...editData,
                    content: imageMarkdown + editData.content,
                    existingImages: [...editData.existingImages, data.url]
                });
            } else {
                alert('Failed to upload image');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            alert('Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleImageUpload(files[0]);
        }
    };

    // Handle file input change
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleImageUpload(files[0]);
        }
    };

    // Handle removing existing image
    const handleRemoveImage = (imageUrl: string) => {
        // Remove image markdown from content
        const imageMarkdownPattern = new RegExp(`!\\[.*?\\]\\(${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n*`, 'g');
        const newContent = editData.content.replace(imageMarkdownPattern, '');

        // Remove from existingImages array
        const newExistingImages = editData.existingImages.filter((img: string) => img !== imageUrl);

        setEditData({
            ...editData,
            content: newContent,
            existingImages: newExistingImages
        });
    };




    const normalizePublished = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'y') return true;
            if (normalized === 'false' || normalized === '0' || normalized === 'n') return false;
        }
        // Legacy rows may omit this field; keep previous default behavior.
        return true;
    };

    const normalizeShow = (value: any): 'Y' | 'N' | 'D' => {
        const normalized = String(value ?? 'Y').trim().toUpperCase();
        if (normalized === 'N') return 'N';
        if (normalized === 'D') return 'D';
        return 'Y';
    };

    // Filter posts based on search query (button/enter triggered)
    // Main grid: published and visible only.
    const activePosts = allPosts.filter(post => {
        const isPublished = normalizePublished(post.isPublished);
        const showStatus = normalizeShow(post.show);
        if (!isPublished || showStatus !== 'Y') return false;

        const cat = (post.category || '').toLowerCase();
        if (activeTab === 'life') {
            return cat === 'cooking' || cat === 'cook';
        }
        return cat === 'tech' || cat === 'biology';
    });

    // Pending posts (Admin only): automated unpublished drafts that are not deleted.
    const pendingPosts = allPosts.filter(post => {
        const isPublished = normalizePublished(post.isPublished);
        const showStatus = normalizeShow(post.show);
        // Only automated (n8n) posts with isPublished=false and show='N' are pending
        if (isPublished || showStatus !== 'N' || !post.isAutomated) return false;

        const cat = (post.category || '').toLowerCase();
        if (activeTab === 'life') {
            return cat === 'cooking' || cat === 'cook';
        }
        return cat === 'tech' || cat === 'biology';
    });

    // State to track active filter
    const [activeFilter, setActiveFilter] = React.useState<string>('All');
    const [showNoPendingDialog, setShowNoPendingDialog] = React.useState(false);



    // Handle Category Change with Dynamic Template
    const handleCategoryChange = (category: string) => {
        let newContent = editData.content;

        if (category === 'Cooking') {
            // If content is empty/whitespace, apply template
            if (!newContent || !newContent.trim()) {
                newContent = COOKING_TEMPLATE;
            }
        } else {
            // Switching AWAY from Cooking
            // If content matches the template exactly (user didn't edit), clear it
            if (newContent === COOKING_TEMPLATE) {
                newContent = '';
            }
        }

        setEditData({ ...editData, category, content: newContent });
    };

    // Reset filter and pagination when activeTab changes
    React.useEffect(() => {
        setActiveFilter('All');
        setCurrentPage(1);
        setSearchQuery('');
        setIsSearching(false);
    }, [activeTab]);

    const handleFilterClick = (filter: string) => {
        if (filter === 'Pending' && pendingPosts.length === 0) {
            setShowNoPendingDialog(true);
            return;
        }
        // Toggle off behavior? Or simple switch? 
        // User behavior usually expects clicking "Tech" shows Tech. Clicking "Tech" again *might* reset, but let's stick to switching.
        if (activeFilter === filter) {
            setActiveFilter('All');
        } else {
            setActiveFilter(filter);
        }
        setCurrentPage(1);
    };

    const filteredPosts = isSearching
        ? activePosts.filter(post => {
            const searchLower = searchQuery.toLowerCase();
            const titleMatch = post.title?.toLowerCase().includes(searchLower);
            const contentMatch = post.content?.toLowerCase().includes(searchLower);
            const tagsMatch = post.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));
            return titleMatch || contentMatch || tagsMatch;
        }).sort((a, b) => {
            // Sort by createdAt descending (most recent first)
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        })
        : activeFilter === 'Pending'
            ? pendingPosts.sort((a, b) => {
                // Sort by createdAt ASCENDING (Oldest first) for Pending view
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateA - dateB;
            })
            : activePosts
                .filter(post => activeFilter === 'All' || post.category === activeFilter)
                .sort((a, b) => {
                    // Always sort by createdAt descending (most recent first) for normal view
                    const dateA = new Date(a.createdAt).getTime();
                    const dateB = new Date(b.createdAt).getTime();
                    return dateB - dateA;
                });

    // Pagination logic
    const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
    const indexOfLastPost = currentPage * postsPerPage;
    const indexOfFirstPost = indexOfLastPost - postsPerPage;
    const posts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);

    // Get global index for selectedPost (using originalIndex from allPosts)
    const getGlobalIndex = (localIndex: number) => {
        const post = posts[localIndex];
        return post?.originalIndex ?? -1;
    };

    // Handle page change
    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        setSelectedPostId(null); // Close any open post when changing pages
    };

    // Handle search - triggered by button click or enter key
    const handleSearch = () => {
        if (searchQuery.trim()) {
            setIsSearching(true);
            setCurrentPage(1); // Reset to first page when searching
        } else {
            setIsSearching(false);
            setCurrentPage(1);
        }
    };

    // Format date helper
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Strip markdown syntax for preview
    const stripMarkdown = (markdown: string) => {
        if (!markdown) return '';

        return markdown
            // Remove images ![alt](url) - MUST be before links to avoid conflicts
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
            // Remove headers (# ## ###)
            .replace(/^#{1,6}\s+/gm, '')
            // Remove code blocks ```code``` - MUST be before inline code
            .replace(/```[\s\S]*?```/g, '')
            // Remove inline code `code`
            .replace(/`([^`]+)`/g, '$1')
            // Remove links [text](url) -> text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove bold (**text** or __text__)
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            // Remove italic (*text* or _text_)
            .replace(/(\*|_)(.*?)\1/g, '$2')
            // Remove blockquotes (>)
            .replace(/^>\s+/gm, '')
            // Remove horizontal rules (---, ___, ***)
            .replace(/^([-_*]){3,}$/gm, '')
            // Remove list markers (-, *, +, 1.)
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // Remove extra whitespace and newlines
            .replace(/\n\s*\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const renderSidebar = () => (
        <>
            <h3
                className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-slate-600 transition-colors"
                onClick={() => handleFilterClick('All')}
            >
                Latest Posts
            </h3>
            <hr className="border-slate-200 my-2" />

            {/* Sidebar content based on Active Tab */}
            {activeTab === 'life' ? (
                /* LIFE Sidebar */
                <>
                    {/* Cooking Section */}
                    <h4
                        className={`text-sm font-bold mb-2 cursor-pointer transition-colors ${activeFilter === 'Cooking' ? 'text-pink-700 underline' : 'text-pink-500 hover:text-pink-700'}`}
                        onClick={() => handleFilterClick('Cooking')}
                    >
                        Cooking
                    </h4>
                    {activePosts
                        .map((post, index) => ({ ...post, originalIndex: index }))
                        .filter(post => post.category === 'Cooking')
                        .slice(0, 3)
                        .map((post) => (
                            <div
                                key={post._id}
                                onClick={() => {
                                    setSelectedPostId(post._id);
                                }}
                                className={`
                                    group cursor-pointer transition-all duration-200
                                    bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                    hover:${post.color} hover:${post.borderColor}
                                `}
                            >
                                <p className={`
                                    text-sm font-medium text-slate-600 truncate
                                    group-hover:${post.textColor}
                                `}>
                                    {post.title}
                                </p>
                            </div>
                        ))}
                </>
            ) : (
                /* TECH Sidebar */
                <>
                    {/* Tech Section */}
                    <h4
                        className={`text-sm font-bold mb-2 cursor-pointer transition-colors ${activeFilter === 'Tech' ? 'text-pink-700 underline' : 'text-pink-500 hover:text-pink-700'}`}
                        onClick={() => handleFilterClick('Tech')}
                    >
                        Tech
                    </h4>
                    {activePosts
                        .map((post, index) => ({ ...post, originalIndex: index }))
                        .filter(post => post.category === 'Tech')
                        .slice(0, 3)
                        .map((post) => (
                            <div
                                key={post._id}
                                onClick={() => {
                                    setSelectedPostId(post._id);
                                }}
                                className={`
                                    group cursor-pointer transition-all duration-200
                                    bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                    hover:${post.color} hover:${post.borderColor}
                                `}
                            >
                                <p className={`
                                    text-sm font-medium text-slate-600 truncate
                                    group-hover:${post.textColor}
                                `}>
                                    {post.title}
                                </p>
                            </div>
                        ))}

                    <hr className="border-slate-200 my-4" />

                    {/* Bio Section */}
                    <h4
                        className={`text-sm font-bold mb-2 cursor-pointer transition-colors ${activeFilter === 'Biology' ? 'text-pink-700 underline' : 'text-pink-500 hover:text-pink-700'}`}
                        onClick={() => handleFilterClick('Biology')}
                    >
                        Bio
                    </h4>
                    {activePosts
                        .map((post, index) => ({ ...post, originalIndex: index }))
                        .filter(post => post.category === 'Biology')
                        .slice(0, 3)
                        .map((post) => (
                            <div
                                key={post._id}
                                onClick={() => {
                                    setSelectedPostId(post._id);
                                }}
                                className={`
                                    group cursor-pointer transition-all duration-200
                                    bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                    hover:${post.color} hover:${post.borderColor}
                                `}
                            >
                                <p className={`
                                    text-sm font-medium text-slate-600 truncate
                                    group-hover:${post.textColor}
                                `}>
                                    {post.title}
                                </p>
                            </div>
                        ))}
                </>
            )}

            {/* PENDING Post Section (Admin Only) */}
            {isAuthorized && (
                <>
                    <hr className="border-slate-200 my-4" />
                    <h4
                        className={`text-sm font-bold mb-2 flex justify-between items-center cursor-pointer transition-colors ${activeFilter === 'Pending' ? 'text-pink-700 underline' : 'text-pink-500 hover:text-pink-700'}`}
                        onClick={() => handleFilterClick('Pending')}
                    >
                        <span>Pending</span>
                        <span className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full text-xs">
                            {pendingPosts.length}
                        </span>
                    </h4>
                    {pendingPosts
                        .slice(0, 3)
                        .map((post) => {
                            const originalIndex = allPosts.findIndex(p => p._id === post._id);
                            return (
                                <div
                                    key={post._id}
                                    onClick={() => setSelectedPostId(post._id)}
                                    className={`
                                        group cursor-pointer transition-all duration-200
                                        bg-slate-50 px-4 py-3 rounded-lg border border-slate-200
                                        hover:${post.color} hover:${post.borderColor}
                                    `}
                                >
                                    <p className={`
                                        text-sm font-medium text-slate-600 truncate
                                        group-hover:${post.textColor}
                                    `}>
                                        {post.title}
                                    </p>
                                </div>
                            );
                        })}
                </>
            )}
        </>
    );

    return (
        <>
            <BlogLayout
                title="Blog"
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => navigate(`/blog/${id}`)}
                sidebar={renderSidebar()}
            >
                <BlogGrid
                    posts={posts}
                    loading={loading}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    onPostClick={(localIndex) => {
                        const post = posts[localIndex];
                        if (post && post._id) setSelectedPostId(post._id);
                    }}
                    onLike={handleLike}
                    isLikedByUser={isLikedByUser}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onSearch={handleSearch}
                    emptyMessage={activeTab === 'life' ? "Life Blog Under Construction" : "No posts found."}
                />
            </BlogLayout>

            {/* Modal Popup - View/Edit Mode */}
            {
                selectedPost && !isEditMode && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-modalBackdrop"
                        onClick={() => setSelectedPostId(null)}
                    >
                        <div
                            className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl animate-modalContent"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={`${selectedPost.color} p-8`}>
                                <span className={`text-xs font-bold uppercase tracking-wider ${selectedPost.textColor} bg-white/80 w-fit px-3 py-1.5 rounded-md`}>
                                    {selectedPost.category}
                                </span>
                                <h2 className="text-3xl font-bold text-slate-900 mt-4">
                                    {selectedPost.title}
                                </h2>
                            </div>
                            <div className="p-8 overflow-y-auto max-h-[calc(85vh-200px)]">
                                <div className="markdown-content text-slate-700 leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkBreaks]}
                                        components={markdownComponents}
                                    >
                                        {selectedPost.content}
                                    </ReactMarkdown>
                                </div>

                                {/* Tags Section */}
                                <div className="mt-8 pt-6 border-t border-slate-200">
                                    <div className="flex flex-wrap gap-2">
                                        {(() => {
                                            const normalizedTags = selectedPost.tags
                                                .flatMap((t: string) => t.split(','))
                                                .map((t: string) => t.trim())
                                                .filter((t: string) => t);

                                            return (
                                                <>
                                                    {normalizedTags.map((tag: string, idx: number) => (
                                                        <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Footer in modal */}
                                <div className={`mt-4 flex items-center justify-between ${!selectedPost.tags || selectedPost.tags.length === 0 ? 'pt-6 border-t border-slate-200' : ''}`}>
                                    <button
                                        onClick={(e) => handleLike(selectedPost._id, e)}
                                        className="flex items-center gap-3 cursor-pointer hover:scale-110 transition-transform"
                                    >
                                        <span className={`text-2xl ${isLikedByUser(selectedPost) ? 'text-red-500' : 'text-gray-400'}`}>
                                            {isLikedByUser(selectedPost) ? '❤️' : '🤍'}
                                        </span>
                                        <span className="font-medium text-slate-700 text-base">{selectedPost.likes || 0}</span>
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500">{formatDate(selectedPost.createdAt)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-8">
                                    <div className="flex gap-4">
                                        {/* Delete/Update buttons for Admin (Authorized) users */}
                                        {isAuthorized && (
                                            <div className="flex gap-4">
                                                {/* Publish button for pending posts */}
                                                {!selectedPost.isPublished && (
                                                    <button
                                                        onClick={handlePublishClick}
                                                        className="px-6 py-3 bg-green-600 text-white rounded-full font-bold hover:bg-green-700 transition-colors"
                                                    >
                                                        Publish
                                                    </button>
                                                )}
                                                {(user && isAuthorized) && (
                                                    <button
                                                        onClick={handleEdit}
                                                        className="px-6 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-700 transition-colors"
                                                    >
                                                        Update
                                                    </button>
                                                )}
                                                <button
                                                    onClick={handleDelete}
                                                    className="px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedPostId(null)}
                                        className="px-6 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-700 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div >
                )
            }

            {/* Edit Mode Modal */}
            {
                selectedPost && (
                    <BlogPostModal
                        mode="edit"
                        isOpen={isEditMode}
                        editData={editData}
                        postColor={selectedPost.color}
                        uploadingImage={uploadingImage}
                        isDragging={isDragging}
                        onClose={handleCloseEdit}
                        onSave={handleSave}
                        onCategoryChange={handleCategoryChange}
                        onTitleChange={(title: string) => setEditData({ ...editData, title })}
                        onContentChange={(content: string) => setEditData({ ...editData, content })}
                        onTagInput={handleTagInput}
                        onTagBlur={handleTagBlur}
                        onImageUpload={handleFileSelect}
                        onRemoveImage={handleRemoveImage}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    />
                )
            }

            {/* Discard Confirmation Dialog */}
            {
                showDiscardDialog && (
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                isCreateMode ? handleDiscardCreate() : handleDiscard();
                            }
                        }}
                    >
                        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
                            <button
                                onClick={isCreateMode ? () => setShowDiscardDialog(false) : handleContinueEdit}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold"
                            >
                                ✕
                            </button>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Unsaved Changes</h3>
                            <p className="text-slate-600 mb-6">
                                {isCreateMode
                                    ? 'Your new post will not be saved. Are you sure you want to discard it?'
                                    : 'Your changes will not be saved. Are you sure you want to discard them?'}
                            </p>
                            <div className="flex gap-4 justify-end">
                                <button
                                    onClick={isCreateMode ? () => setShowDiscardDialog(false) : handleContinueEdit}
                                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-full font-bold hover:bg-slate-300 transition-colors"
                                >
                                    {isCreateMode ? 'Continue Writing' : 'Continue Editing'}
                                </button>
                                <button
                                    onClick={isCreateMode ? handleDiscardCreate : handleDiscard}
                                    className="px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-colors"
                                >
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Dialog */}
            {
                showDeleteDialog && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Delete Confirmation</h3>
                            <p className="text-slate-600 mb-6">Are you sure you want to delete this post?</p>
                            <div className="flex gap-4 justify-end">
                                <button
                                    onClick={handleCancelDelete}
                                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-full font-bold hover:bg-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-colors"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Publish Confirmation Dialog */}
            {
                showPublishDialog && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Publish Confirmation</h3>
                            <p className="text-slate-600 mb-6">Are you sure you want to publish this post?</p>
                            <div className="flex gap-4 justify-end">
                                <button
                                    onClick={() => setShowPublishDialog(false)}
                                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-full font-bold hover:bg-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmPublish}
                                    className="px-6 py-2 bg-green-600 text-white rounded-full font-bold hover:bg-green-700 transition-colors"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Mode Modal */}
            <BlogPostModal
                mode="create"
                isOpen={isCreateMode}
                editData={editData}
                postColor="bg-pink-50"

                uploadingImage={uploadingImage}
                isDragging={isDragging}
                onClose={handleCreateCancel}
                onSave={handleCreateSave}
                onCategoryChange={handleCategoryChange}
                onTitleChange={(title: string) => setEditData({ ...editData, title })}
                onContentChange={(content: string) => setEditData({ ...editData, content })}
                onTagInput={handleTagInput}
                onTagBlur={handleTagBlur}

                onImageUpload={handleFileSelect}
                onRemoveImage={handleRemoveImage}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            />


            {/* Validation Dialog */}
            {
                showValidationDialog && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl relative text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">⚠️</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Missing Information</h3>
                            <p className="text-slate-600 mb-8">Please fill in all fields (Category, Title, and Content) before saving.</p>
                            <button
                                onClick={() => setShowValidationDialog(false)}
                                className="w-full px-6 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-700 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                )
            }

            {/* No Pending Posts Dialog */}
            {
                showNoPendingDialog && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl relative text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">ℹ️</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No Pending Posts</h3>
                            <p className="text-slate-600 mb-8">There are currently no posts pending approval.</p>
                            <button
                                onClick={() => setShowNoPendingDialog(false)}
                                className="w-full px-6 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Create Button (+ icon) - Blog page only */}
            {
                canCreatePost() && location.pathname.startsWith('/blog') && !isCreateMode && !isEditMode && selectedPost === null && (
                    <button
                        onClick={handleCreate}
                        className="fixed bottom-24 left-6 w-14 h-14 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-pink-600 transition-all hover:scale-110 z-40"
                        title="Create new post"
                    >
                        <Plus size={28} />
                    </button>
                )
            }

            {/* Toast Notification */}
            {
                showToast && (
                    <div
                        className="fixed z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg animate-fadeIn flex items-center gap-2 pointer-events-none"
                        style={{
                            left: toastPos.x + 16,
                            top: toastPos.y - 40,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {toastMessage}
                    </div>
                )
            }
        </>
    );
};
