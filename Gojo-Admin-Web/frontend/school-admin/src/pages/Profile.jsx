import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { getAdminProfile, getAllPosts } from "../api.js";
import PostCard from "../components/PostCard.jsx";

export default function Profile(){
  const { adminId } = useParams();
  const [admin, setAdmin] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(()=>{
    fetchProfile();
    fetchPosts();
  }, [adminId]);

  async function fetchProfile(){
    try {
      const res = await getAdminProfile(adminId);
      if (res?.success) setAdmin(res.admin);
      else setAdmin({name:"Admin", username:""});
    } catch(err){
      console.error(err);
    }
  }

  async function fetchPosts(){
    try {
      const all = await getAllPosts();
      const normalized = Array.isArray(all) ? all : [];
      setPosts(
        normalized.filter(
          (p) => String(p.adminId || "") === String(adminId || "") || String(p.userId || "") === String(adminId || "")
        )
      );
    } catch(err){
      console.error(err);
    }
  }

  if (!admin) return <div className="container"><div className="card">Loading profile…</div></div>;

  return (
    <div className="container">
      <div className="card"><Navbar /></div>
      <div className="app-layout" style={{marginTop:4}}>
        <Sidebar admin={admin} />
        <div style={{flex:1}}>
          <div className="card">
            <h2>{admin.name}</h2>
            <p className="small-muted">@{admin.username}</p>
            <ProfileAvatar src={admin.profileImage} name={admin.name || admin.username || "Admin"} alt="profile" style={{ width: 140, height: 140, borderRadius: 10, marginTop: 8, objectFit: "cover" }} />
          </div>

          <div style={{marginTop:12}}>
            <h3>Your Posts</h3>
            {posts.length === 0 && <div className="card small-muted">No posts yet</div>}
            {posts.map(p => <PostCard key={p.postId} post={p} isOwner={String(p.adminId || "") === String(adminId || "")} />)}
          </div>
        </div>
      </div>
    </div>


    
  );


  
}
