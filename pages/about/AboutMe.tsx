import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import { API_URL } from '../../utils/apiConfig';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

interface AboutMeData {
    _id?: string;
    introduction: string;
    research_interests: string[];
    hobbies: string[];
    future_goal: string;
}

interface AboutMeProps {
    user: any;
    isAuthorized: boolean;
}

// Helper function to create cropped image from canvas
const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob | null> => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Set canvas size to the cropped area size
            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;

            // Draw the cropped portion of the image
            ctx.drawImage(
                image,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                pixelCrop.width,
                pixelCrop.height
            );

            // Convert canvas to blob
            canvas.toBlob(
                (blob) => {
                    resolve(blob);
                },
                'image/jpeg',
                0.95
            );
        };

        image.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        image.src = imageSrc;
    });
};

export const AboutMe: React.FC<AboutMeProps> = ({ user, isAuthorized }) => {
    const [aboutMe, setAboutMe] = useState<AboutMeData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [aboutMeForm, setAboutMeForm] = useState({
        introduction: '',
        research_interests: '',
        hobbies: '',
        future_goal: ''
    });
    const [profilePicTimestamp, setProfilePicTimestamp] = useState(Date.now());
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    // react-easy-crop state
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    useLockBodyScroll(isModalOpen);

    useEffect(() => {
        fetchAboutMe();
    }, []);

    const fetchAboutMe = async () => {
        try {
            const response = await fetch(`${API_URL}/api/about-me`);
            if (response.ok) {
                const data = await response.json();
                setAboutMe(data);
            }
        } catch (error) {
            console.error('Failed to fetch about me:', error);
        }
    };

    const handleSaveAboutMe = async () => {
        if (!user) return;

        try {
            const isCreating = !aboutMe?._id;
            const url = isCreating
                ? `${API_URL}/api/about-me`
                : `${API_URL}/api/about-me/${aboutMe._id}`;
            const method = isCreating ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    introduction: aboutMeForm.introduction,
                    research_interests: aboutMeForm.research_interests.split('\n').filter(i => i.trim()),
                    hobbies: aboutMeForm.hobbies.split('\n').filter(h => h.trim()),
                    future_goal: aboutMeForm.future_goal,
                    email: user.email
                })
            });

            if (response.ok) {
                // If there's a crop selection, upload the cropped image
                if (croppedAreaPixels) {
                    await uploadCroppedImage();
                }
                fetchAboutMe();
                closeModal();
            }
        } catch (error) {
            console.error('Failed to save about me:', error);
        }
    };

    const uploadCroppedImage = async () => {
        if (!user || !croppedAreaPixels) return;

        try {
            // Use the original image for cropping
            const imageSrc = `https://storage.googleapis.com/distilledchild/about/me/distilledchild-profile-pic-original.jpg?t=${profilePicTimestamp}`;
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

            if (croppedBlob) {
                const formData = new FormData();
                formData.append('image', croppedBlob, 'cropped-profile.jpg');
                formData.append('email', user.email);
                formData.append('isCropped', 'true');

                await fetch(`${API_URL}/api/about-me/upload-profile-pic`, {
                    method: 'POST',
                    body: formData,
                });

                // Bust cache for the profile picture
                setProfilePicTimestamp(Date.now());
            }
        } catch (error) {
            console.error('Failed to upload cropped image:', error);
        }
    };

    const handleImageUpload = async (file: File) => {
        if (!user || !file.type.startsWith('image/')) return;

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('email', user.email);

            const response = await fetch(`${API_URL}/api/about-me/upload-profile-pic`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                // Bust cache for the profile picture
                setProfilePicTimestamp(Date.now());
            } else {
                alert('Failed to upload profile picture');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            alert('Failed to upload profile picture');
        } finally {
            setUploadingImage(false);
        }
    };

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleImageUpload(files[0]);
        }
    };

    const openAboutMeModal = () => {
        if (aboutMe) {
            setAboutMeForm({
                introduction: aboutMe.introduction || '',
                research_interests: aboutMe.research_interests?.join('\n') || '',
                hobbies: aboutMe.hobbies?.join('\n') || '',
                future_goal: aboutMe.future_goal || '',
                profile_pic_position: aboutMe.profile_pic_position || { x: 50, y: 50 }
            });
        }
        setIsModalOpen(true);
    };

    const onCropComplete = useCallback((_: Area, croppedAreaPixelsParam: Area) => {
        // Store the pixel coordinates of the cropped area
        // This will be used to crop the image with canvas before uploading
        setCroppedAreaPixels(croppedAreaPixelsParam);
    }, []);

    const closeModal = () => {
        setIsModalOpen(false);
    };

    return (
        <div className="animate-fadeIn space-y-8 text-slate-700 leading-relaxed text-lg relative" style={{ textAlign: 'justify' }}>
            <div className="block overflow-hidden">
                <div className="float-left mr-8 mb-4">
                    <img
                        src={`https://storage.googleapis.com/distilledchild/about/me/distilledchild-profile-pic.jpg?t=${profilePicTimestamp}`}
                        alt="Profile"
                        className="w-72 h-72 rounded-2xl object-cover shadow-lg transition-all duration-300"
                        onError={(e) => {
                            // Use a more visible placeholder if the image is missing
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('placeholder')) {
                                target.src = 'https://via.placeholder.com/300/f8fafc/64748b?text=Upload+Profile+Photo';
                            }
                        }}
                    />
                </div>
                <div
                    dangerouslySetInnerHTML={{ __html: aboutMe?.introduction || '' }}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-12">

                <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-lg" style={{ textAlign: 'left' }}>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Research Interests</h3>
                    <ul className="space-y-3 text-base">
                        {aboutMe?.research_interests?.map((interest, idx) => (
                            <li key={idx}>• {interest}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-lg" style={{ textAlign: 'left' }}>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Hobbies</h3>
                    <ul className="space-y-3 text-base">
                        {aboutMe?.hobbies?.map((hobby, idx) => (
                            <li key={idx}>• {hobby}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <p dangerouslySetInnerHTML={{ __html: aboutMe?.future_goal || '' }} />

            {/* Admin Add Button */}
            {
                isAuthorized && (
                    <div className="fixed bottom-24 left-6 z-50">
                        <button
                            onClick={openAboutMeModal}
                            className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition-all hover:scale-110"
                            title="Edit About Me"
                        >
                            <Plus size={28} />
                        </button>
                    </div>
                )
            }

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                            <button
                                onClick={closeModal}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <h3 className="text-2xl font-bold text-slate-900 mb-6">Edit About Me</h3>

                            <div className="space-y-4">
                                {/* Profile Picture Upload & Focus Point */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Profile Picture</label>
                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`border-2 border-dashed rounded-xl p-4 transition-all ${isDragging
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
                                            }`}
                                    >
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            id="profile-pic-upload"
                                        />
                                        {uploadingImage ? (
                                            <div className="text-center py-8">
                                                <div className="text-blue-500 font-bold animate-pulse text-lg">Uploading...</div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {/* React Easy Crop Area */}
                                                <div className="relative h-72 bg-slate-900 rounded-lg overflow-hidden">
                                                    <Cropper
                                                        image={`https://storage.googleapis.com/distilledchild/about/me/distilledchild-profile-pic-original.jpg?t=${profilePicTimestamp}`}
                                                        crop={crop}
                                                        zoom={zoom}
                                                        aspect={1}
                                                        onCropChange={setCrop}
                                                        onZoomChange={setZoom}
                                                        onCropComplete={onCropComplete}
                                                        cropShape="rect"
                                                        showGrid={false}
                                                    />
                                                </div>

                                                {/* Zoom Slider */}
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-slate-500">Zoom</span>
                                                    <input
                                                        type="range"
                                                        min={1}
                                                        max={3}
                                                        step={0.1}
                                                        value={zoom}
                                                        onChange={(e) => setZoom(Number(e.target.value))}
                                                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        aria-label="Zoom level"
                                                    />
                                                    <span className="text-sm text-slate-500 w-10">{zoom.toFixed(1)}x</span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm text-slate-600 font-medium">Drag to adjust position, use slider to zoom</p>
                                                        <p className="text-xs text-slate-400">The center square area will be shown as your profile</p>
                                                    </div>
                                                    <label htmlFor="profile-pic-upload" className="cursor-pointer px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
                                                        Upload New Photo
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>



                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Introduction (HTML supported)</label>
                                    <textarea
                                        value={aboutMeForm.introduction}
                                        onChange={e => setAboutMeForm({ ...aboutMeForm, introduction: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
                                        placeholder="Enter introduction..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Research Interests (One per line)</label>
                                    <textarea
                                        value={aboutMeForm.research_interests}
                                        onChange={e => setAboutMeForm({ ...aboutMeForm, research_interests: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                        placeholder="Enter research interests..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Hobbies (One per line)</label>
                                    <textarea
                                        value={aboutMeForm.hobbies}
                                        onChange={e => setAboutMeForm({ ...aboutMeForm, hobbies: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                        placeholder="Enter hobbies..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Future Goal (HTML supported)</label>
                                    <textarea
                                        value={aboutMeForm.future_goal}
                                        onChange={e => setAboutMeForm({ ...aboutMeForm, future_goal: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                        placeholder="Enter future goal..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={handleSaveAboutMe}
                                        className="flex-1 px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
