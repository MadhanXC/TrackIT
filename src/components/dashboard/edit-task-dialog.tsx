
'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Save,
  Loader2,
  Search,
  Layout,
  FileText,
  Package,
  Calendar,
  Layers,
  User,
  Truck,
  Trash2
} from 'lucide-react';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const GEOAPIFY_API_KEY = 'd83a3b59eb364a52a89040fa84473345';

const SURVEY_STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed', 'On Hold'];
const PERMIT_STATUS_OPTIONS = ['Not Applied', 'Applied', 'In Review', 'Approved', 'Expired', 'Denied'];
const SHIPMENT_STATUS_OPTIONS = ['Pending', 'Shipped', 'In Transit', 'Delivered', 'Delayed'];

const formSchema = z.object({
  workItemType: z.enum(['Job', 'Project']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  title: z.string().min(2, 'Title required'),
  street1: z.string().min(1, 'Address required'),
  pocName: z.string().optional(),
  description: z.string().min(5, 'Description required'),
  source: z.enum(['Call', 'Email', 'Text', 'In-person', 'To-do entry']).default('Call'),
  surveyRequired: z.boolean().default(false),
  surveyHandledBy: z.enum(['PLS', 'Others']).default('PLS'),
  surveyHandlerOthers: z.string().optional(),
  surveyStatus: z.string().default('Scheduled'),
  permitRequired: z.boolean().default(false),
  permitHandledBy: z.enum(['PLS', 'Others']).default('PLS'),
  permitHandlerOthers: z.string().optional(),
  permitStatus: z.string().default('Not Applied'),
  materialsRequired: z.boolean().default(false),
  materialsList: z.array(z.object({ name: z.string(), quantity: z.string() })).default([]),
  shipmentRequired: z.boolean().default(false),
  shipmentStatus: z.string().default('Pending'),
  confirmationStatus: z.enum(['Pending', 'Confirmed']).default('Pending'),
  overallWorkStatus: z.string().default('Pending'),
  dateInitiated: z.string().optional(),
  dateCompleted: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditTaskDialog({ task, trigger, readOnly = false }: { task: any, trigger?: React.ReactNode, readOnly?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  
  const lastFetchedValueRef = React.useRef<string>(task?.siteAddressStreet?.trim()?.toLowerCase() || '');
  const firestore = useFirestore();
  const { toast } = useToast();

  const isHandlerPLS = (handler: string) => handler === 'PLS';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workItemType: task?.workItemType || 'Job',
      priority: task?.priority || 'Medium',
      title: task?.title || '',
      street1: task?.siteAddressStreet || '',
      pocName: task?.pocName || '',
      description: task?.description || '',
      source: task?.source || 'Call',
      surveyRequired: !!task?.surveyRequired,
      surveyHandledBy: isHandlerPLS(task?.surveyHandler) ? 'PLS' : 'Others',
      surveyHandlerOthers: isHandlerPLS(task?.surveyHandler) ? '' : task?.surveyHandler,
      surveyStatus: task?.surveyStatus || 'Scheduled',
      permitRequired: !!task?.permitRequired,
      permitHandledBy: isHandlerPLS(task?.permitHandler) ? 'PLS' : 'Others',
      permitHandlerOthers: isHandlerPLS(task?.permitHandler) ? '' : task?.permitHandler,
      permitStatus: task?.permitStatus || 'Not Applied',
      materialsRequired: !!task?.materialsRequired,
      materialsList: task?.materialsList || [],
      shipmentRequired: !!task?.shipmentRequired,
      shipmentStatus: task?.shipmentStatus || 'Pending',
      confirmationStatus: task?.confirmationStatus || 'Pending',
      overallWorkStatus: task?.overallWorkStatus || 'Pending',
      dateInitiated: task?.dateInitiated || '',
      dateCompleted: task?.dateCompleted || '',
    },
  });

  React.useEffect(() => {
    if (open && task) {
      form.reset({
        workItemType: task.workItemType || 'Job',
        priority: task.priority || 'Medium',
        title: task.title || '',
        street1: task.siteAddressStreet || '',
        pocName: task.pocName || '',
        description: task.description || '',
        source: task.source || 'Call',
        surveyRequired: !!task.surveyRequired,
        surveyHandledBy: isHandlerPLS(task.surveyHandler) ? 'PLS' : 'Others',
        surveyHandlerOthers: isHandlerPLS(task.surveyHandler) ? '' : task.surveyHandler,
        surveyStatus: task.surveyStatus || 'Scheduled',
        permitRequired: !!task.permitRequired,
        permitHandledBy: isHandlerPLS(task.permitHandler) ? 'PLS' : 'Others',
        permitHandlerOthers: isHandlerPLS(task.permitHandler) ? '' : task.permitHandler,
        permitStatus: task.permitStatus || 'Not Applied',
        materialsRequired: !!task.materialsRequired,
        materialsList: task.materialsList || [],
        shipmentRequired: !!task.shipmentRequired,
        shipmentStatus: task.shipmentStatus || 'Pending',
        confirmationStatus: task.confirmationStatus || 'Pending',
        overallWorkStatus: task.overallWorkStatus || 'Pending',
        dateInitiated: task.dateInitiated || '',
        dateCompleted: task.dateCompleted || '',
      });
    }
  }, [open, task, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materialsList"
  });

  const street1Value = form.watch('street1');
  const surveyRequired = form.watch('surveyRequired');
  const surveyHandledBy = form.watch('surveyHandledBy');
  const permitRequired = form.watch('permitRequired');
  const permitHandledBy = form.watch('permitHandledBy');
  const materialsRequired = form.watch('materialsRequired');
  const shipmentRequired = form.watch('shipmentRequired');
  const confirmationStatus = form.watch('confirmationStatus');

  React.useEffect(() => {
    const fetchAddresses = async () => {
      const val = street1Value?.trim()?.toLowerCase() || '';
      if (readOnly || !isInputFocused || val.length < 5 || val === lastFetchedValueRef.current) return;
      setIsSearching(true);
      try {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(val)}&filter=countrycode:us&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
        setShowDropdown(true);
      } catch (e) { console.error(e); } finally { setIsSearching(false); }
    };
    const t = setTimeout(fetchAddresses, 800);
    return () => clearTimeout(t);
  }, [street1Value, readOnly, isInputFocused]);

  const handleSelectAddress = (f: any) => {
    const formatted = (f.properties.formatted || '').replace(/,?\s*(United States of America|United States)$/i, '');
    lastFetchedValueRef.current = formatted.trim().toLowerCase();
    form.setValue('street1', formatted, { shouldValidate: true });
    setShowDropdown(false);
  };

  async function onSubmit(values: FormValues) {
    if (!firestore || readOnly || !task?.id) return;
    setIsSubmitting(true);
    try {
      const finalSurveyHandler = values.surveyHandledBy === 'PLS' ? 'PLS' : values.surveyHandlerOthers || 'Others';
      const finalPermitHandler = values.permitHandledBy === 'PLS' ? 'PLS' : values.permitHandlerOthers || 'Others';
      
      const docRef = doc(firestore, 'workItems', task.id);
      
      const updateData: any = {
        workItemType: values.workItemType,
        priority: values.priority,
        title: values.title,
        siteAddressStreet: values.street1,
        pocName: values.pocName || '',
        description: values.description,
        source: values.source,
        surveyRequired: values.surveyRequired,
        surveyHandler: values.surveyRequired ? finalSurveyHandler : 'N/A',
        surveyStatus: values.surveyRequired ? values.surveyStatus : 'N/A',
        permitRequired: values.permitRequired,
        permitHandler: values.permitRequired ? finalPermitHandler : 'N/A',
        permitStatus: values.permitRequired ? values.permitStatus : 'N/A',
        materialsRequired: values.materialsRequired,
        materialsList: values.materialsRequired ? (values.materialsList || []) : [],
        shipmentRequired: values.shipmentRequired,
        shipmentStatus: values.shipmentRequired ? values.shipmentStatus : 'N/A',
        confirmationStatus: values.confirmationStatus,
        overallWorkStatus: values.dateCompleted ? 'Completed' : values.overallWorkStatus,
        dateInitiated: values.dateInitiated || '',
        dateCompleted: values.dateCompleted || '',
        updatedAt: new Date().toISOString()
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          updateData[key] = '';
        }
      });

      updateDocumentNonBlocking(docRef, updateData);
      toast({ title: 'Success', description: `Changes updated.` });
      setOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update entry." }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="rounded-none border-slate-950 font-bold uppercase text-[10px] tracking-widest">Modify</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden border-none shadow-2xl p-0 rounded-none bg-white flex flex-col">
        <DialogHeader className="p-4 md:p-6 border-b border-slate-200 flex flex-row items-center justify-between bg-white z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-none bg-slate-950 flex items-center justify-center shrink-0">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <DialogTitle className="text-base md:text-[15px] font-bold text-slate-950 uppercase tracking-tight">
                {readOnly ? 'Entry Details' : `Modify Item`}
              </DialogTitle>
              {!readOnly && task?.id && (
                <Badge variant="outline" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-none px-0">Ref: {task.id.slice(0, 8)}</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          {readOnly ? (
            <div className="space-y-12">
              <div className="space-y-2 border-l-4 border-primary pl-6">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-950 leading-tight tracking-tight uppercase">{task?.siteAddressStreet}</h1>
                <p className="text-[14px] md:text-[16px] font-bold text-slate-400 uppercase tracking-widest">{task?.title}</p>
              </div>
              <div className="bg-slate-50 p-6 border border-slate-100">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="h-3 w-3" /> Point of Contact
                  </p>
                  <p className="text-[13px] font-bold text-slate-950 whitespace-pre-wrap">{task?.pocName || 'No contact info provided'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-y border-slate-100 py-8">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</p>
                  <Badge variant="outline" className={cn("font-bold uppercase text-[11px] rounded-none border-none px-0", task?.priority === 'Urgent' ? "text-red-600" : "text-slate-950")}>{task?.priority}</Badge>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <p className="font-bold text-slate-950 uppercase text-[11px]">{task?.overallWorkStatus}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</p>
                  <p className="font-bold text-slate-950 uppercase text-[11px]">{task?.workItemType}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source</p>
                  <p className="font-bold text-slate-950 uppercase text-[11px]">{task?.source}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-950">Task Details</h3>
                  </div>
                  <p className="text-[13px] font-medium text-slate-600 leading-relaxed bg-slate-50 p-6 border border-slate-100 whitespace-pre-wrap">{task?.description || 'No description provided.'}</p>
                </div>
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-950">Handlers</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 border border-slate-100 bg-white">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Permit</p>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-950 uppercase">{task?.permitRequired ? task?.permitStatus : 'N/A'}</span>
                          {task?.permitRequired && (
                            <span className="text-[10px] text-primary font-bold uppercase mt-1">By: {task?.permitHandler}</span>
                          )}
                        </div>
                      </div>
                      <div className="p-4 border border-slate-100 bg-white">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Survey</p>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-950 uppercase">{task?.surveyRequired ? task?.surveyStatus : 'N/A'}</span>
                          {task?.surveyRequired && (
                            <span className="text-[10px] text-primary font-bold uppercase mt-1">By: {task?.surveyHandler}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-950">Timeline</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Initiated</p>
                        <p className="text-[11px] font-bold text-slate-950">{task?.dateInitiated || 'Not Commenced'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Completed</p>
                        <p className="text-[11px] font-bold text-slate-950">{task?.dateCompleted || 'Not Completed'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Button onClick={() => setOpen(false)} className="w-full font-bold h-14 bg-slate-950 text-white rounded-none uppercase text-sm tracking-widest">Return to Workspace</Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <FormField 
                    control={form.control} 
                    name="workItemType" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            <SelectItem value="Job">Job</SelectItem>
                            <SelectItem value="Project">Project</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="priority" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Low', 'Medium', 'High', 'Urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="source" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Call', 'Email', 'Text', 'In-person', 'To-do entry'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                </div>

                <FormField 
                  control={form.control} 
                  name="pocName" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <User className="h-3 w-3" /> POC (Optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Contact details..." 
                          className="border-slate-300 font-bold min-h-[80px] rounded-none resize-none text-[13px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <FormField 
                  control={form.control} 
                  name="title" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Reference Title</FormLabel>
                      <FormControl>
                        <Input className="border-slate-300 font-bold h-11 rounded-none text-[13px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <div className="space-y-2 relative">
                  <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Address</FormLabel>
                  <FormField 
                    control={form.control} 
                    name="street1" 
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                              className="pl-10 border-slate-300 font-bold h-11 rounded-none text-[13px]" 
                              {...field} 
                              autoComplete="off" 
                              onFocus={() => setIsInputFocused(true)} 
                              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)} 
                            />
                          </div>
                        </FormControl>
                        {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
                            {searchResults.map((r, i) => (
                              <div 
                                key={i} 
                                className="px-4 py-2.5 text-[10px] hover:bg-slate-50 cursor-pointer font-bold border-b border-slate-100" 
                                onMouseDown={() => handleSelectAddress(r)}
                              >
                                {r.properties.formatted}
                              </div>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )} 
                  />
                </div>

                <FormField 
                  control={form.control} 
                  name="description" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Details</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="border-slate-300 font-medium min-h-[100px] resize-none rounded-none text-[13px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirements</p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField 
                      control={form.control} 
                      name="surveyRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[10px] uppercase cursor-pointer">Survey</FormLabel>
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="permitRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[10px] uppercase cursor-pointer">Permit</FormLabel>
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="materialsRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[10px] uppercase cursor-pointer">Materials</FormLabel>
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="shipmentRequired" 
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-slate-400" />
                          </FormControl>
                          <FormLabel className="font-bold text-slate-950 text-[10px] uppercase cursor-pointer">Shipment</FormLabel>
                        </FormItem>
                      )} 
                    />
                  </div>

                  {surveyRequired && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-1">
                      <FormField 
                        control={form.control} 
                        name="surveyHandledBy" 
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Handled By</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                <SelectItem value="PLS">PLS</SelectItem>
                                <SelectItem value="Others">Others</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} 
                      />
                      {surveyHandledBy === 'Others' && (
                        <FormField 
                          control={form.control} 
                          name="surveyHandlerOthers" 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Handler Name</FormLabel>
                              <FormControl>
                                <Input className="h-9 border-slate-300 rounded-none font-bold text-[10px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} 
                        />
                      )}
                      <FormField 
                        control={form.control} 
                        name="surveyStatus" 
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                {SURVEY_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} 
                      />
                    </div>
                  )}

                  {permitRequired && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-1">
                      <FormField 
                        control={form.control} 
                        name="permitHandledBy" 
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Handled By</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                <SelectItem value="PLS">PLS</SelectItem>
                                <SelectItem value="Others">Others</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} 
                      />
                      {permitHandledBy === 'Others' && (
                        <FormField 
                          control={form.control} 
                          name="permitHandlerOthers" 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Handler Name</FormLabel>
                              <FormControl>
                                <Input className="h-9 border-slate-300 rounded-none font-bold text-[10px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} 
                        />
                      )}
                      <FormField 
                        control={form.control} 
                        name="permitStatus" 
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-500">Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                {PERMIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} 
                      />
                    </div>
                  )}

                  {materialsRequired && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 bg-slate-50 p-4 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                          <Package className="h-3 w-3" /> Inventory List
                        </FormLabel>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => append({ name: '', quantity: '1' })}
                          className="h-8 rounded-none border-slate-950 font-bold uppercase text-[10px] tracking-widest"
                        >
                          Add Item
                        </Button>
                      </div>
                      {fields.length === 0 && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-4 border border-dashed border-slate-200">No items added</p>
                      )}
                      {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-400">Item Name</Label>
                            <Input 
                              {...form.register(`materialsList.${index}.name` as const)} 
                              className="h-9 border-slate-300 rounded-none font-bold text-[10px] bg-white" 
                            />
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-400">Qty</Label>
                            <Input 
                              {...form.register(`materialsList.${index}.quantity` as const)} 
                              className="h-9 border-slate-300 rounded-none font-bold text-[10px] bg-white" 
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => remove(index)}
                            className="h-9 w-9 text-slate-300 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {shipmentRequired && (
                    <div className="animate-in fade-in slide-in-from-top-1 bg-slate-50 p-4 border border-slate-200">
                      <FormField 
                        control={form.control} 
                        name="shipmentStatus" 
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                              <Truck className="h-3 w-3" /> Shipment State
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9 border-slate-300 rounded-none font-bold text-[10px] bg-white">
                                  <SelectValue placeholder="Select state..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-none">
                                {SHIPMENT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} 
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                  <FormField 
                    control={form.control} 
                    name="confirmationStatus" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">Confirmation</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                  <FormField 
                    control={form.control} 
                    name="overallWorkStatus" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest">State</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-300 font-bold h-11 rounded-none text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-none">
                            {['Pending', 'In Progress', 'Completed', 'On Hold'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} 
                  />
                </div>

                {confirmationStatus === 'Confirmed' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                    <FormField 
                      control={form.control} 
                      name="dateInitiated" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Date Initiated
                          </FormLabel>
                          <FormControl>
                            <Input type="date" className="border-slate-300 font-bold h-11 rounded-none text-[10px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name="dateCompleted" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-950 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Date Completed
                          </FormLabel>
                          <FormControl>
                            <Input type="date" className="border-slate-300 font-bold h-11 rounded-none text-[10px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                  </div>
                )}

                <Button type="submit" className="w-full font-bold h-14 bg-slate-950 text-white rounded-none uppercase text-sm tracking-widest" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Update Changes
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
