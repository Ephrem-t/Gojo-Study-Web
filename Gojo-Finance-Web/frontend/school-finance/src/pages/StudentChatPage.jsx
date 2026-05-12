import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function StudentChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentId } = location.state || {};
















    useEffect(() => {
      navigate("/all-chat", {
        replace: true,
        state: location.state || undefined,
      });
    }, [location.state, navigate]);

    return null;
}

export default StudentChatPage;
