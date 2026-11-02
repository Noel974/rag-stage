import React from "react";
import { Route, Routes } from "react-router-dom";
import Annuaire from "../pages/annuaire";
import Apropos from "../pages/apropos";
import AssistantIA from "../pages/assitance";
import Home from "../pages/home";
import MentionsLegales from "../pages/mentionlegal";

const Index: React.FC = () => {
    return ( 
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/annuaire" element={<Annuaire />} />
            <Route path="/apropos" element={<Apropos />} />
            <Route path="/assitance" element={<AssistantIA />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
        </Routes>
    );
};

export default Index;