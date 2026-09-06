import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { 
  User, Phone, MapPin, Calendar, Clock, 
  Search, ArrowRight, UserCheck, MessageSquare,
  Activity, ShoppingBag, Filter, ChevronRight
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { format } from 'date-fns';

import CustomerProfileDetail from '../components/CustomerProfileDetail';

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [openDialogId, setOpenDialogId] = useState(null);

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: () => api.get(`/leads/customers/?search=${searchTerm}`).then(r => r.data.results || r.data)
  });

  const customers = Array.isArray(customersData) ? customersData : [];

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            Unified Profiles <div className="w-2 h-2 rounded-full bg-[#C9972A] mt-2"></div>
          </h1>
          <p className="text-gray-500 font-medium mt-1">Cross-interaction relationship management</p>
        </div>

        <div className="relative group min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#C9972A]" size={18} />
          <input 
            type="text" 
            placeholder="Search name, phone, address..."
            className="w-full h-14 pl-12 pr-6 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-[#C9972A]/20 transition-all text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ── Customer List Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3,4,5,6].map(i => (
            <div key={i} className="h-[200px] bg-gray-100 rounded-3xl animate-pulse"></div>
          ))
        ) : (
          customers.map(cust => (
            <div key={cust.id} className="group relative bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 hover:border-[#C9972A]/30 transition-all duration-500 hover:shadow-xl hover:shadow-[#C9972A]/5 overflow-hidden">
               {/* Decor Node */}
               <div className="absolute -top-12 -right-12 w-32 h-32 bg-gray-50 rounded-full group-hover:bg-[#C9972A]/5 transition-colors duration-500"></div>

               <div className="relative flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-[#C9972A] group-hover:text-white transition-all duration-500 shadow-sm">
                      <User size={24} />
                    </div>
                    <Badge variant="outline" className="border-gray-200 text-gray-400 font-bold text-[10px] uppercase tracking-widest group-hover:border-[#C9972A]/30 group-hover:text-[#C9972A]">
                       {cust.lead_count || 0} Leads
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#C9972A] transition-colors">{cust.name}</h3>
                    <p className="text-gray-500 text-sm font-medium flex items-center gap-1">
                       <Phone size={12} /> {cust.phone}
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Calls</p>
                      <p className="text-sm font-black text-gray-800">{cust.total_calls || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Visits</p>
                      <p className="text-sm font-black text-gray-800">{cust.total_visits || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Spent</p>
                      <p className="text-sm font-black text-gray-800">₹{Math.round(cust.total_spent || 0)}</p>
                    </div>
                  </div>

                  <Dialog
                     open={openDialogId === cust.id}
                     onOpenChange={(isOpen) => {
                       setOpenDialogId(isOpen ? cust.id : null);
                       if (isOpen) setSelectedCustomerId(cust.id);
                     }}
                   >
                     <DialogTrigger asChild>
                       <button 
                         className="w-full mt-6 h-12 bg-gray-50 rounded-xl text-gray-900 font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-[#C9972A] group-hover:text-white transition-all duration-500">
                         View Unified Flow <ArrowRight size={16} />
                       </button>
                     </DialogTrigger>
                     <DialogContent className="max-w-[1100px] max-h-[90vh] overflow-y-auto rounded-[40px] border-none shadow-2xl p-8" aria-describedby={undefined}>
                       <DialogHeader>
                         <DialogTitle className="hidden">Customer Profile</DialogTitle>
                       </DialogHeader>
                       {openDialogId === cust.id && <CustomerProfileDetail customerId={cust.id} />}
                     </DialogContent>
                   </Dialog>
               </div>
            </div>
          ))
        )}

        {!isLoading && customers.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-200 mx-auto mb-4">
              <Search size={40} />
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No profiles found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
