import { LightningElement, wire, track, api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getTourPlans from '@salesforce/apex/TourPlansController.getTourPlans';
import getVisitsForCalendar from '@salesforce/apex/TourPlansController.getVisitsForCalendar';
import getVisitsForDate from '@salesforce/apex/TourPlansController.getVisitsForDate';
import { NavigationMixin } from 'lightning/navigation';
import getAccounts from '@salesforce/apex/TourPlansController.getAccounts';
import getVisitTypes from '@salesforce/apex/TourPlansController.getVisitTypes';
import getAccountsByType from '@salesforce/apex/TourPlansController.getAccountsByType';
import createVisits from '@salesforce/apex/TourPlansController.createVisits';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class TourPlan extends NavigationMixin(LightningElement) {
    @track tourPlan = {};
    @track wiredTourPlansResult;
    @track wiredVisitsResult;
    @track isPageLoading = true;
    error;
    @track calendars = [];
    @track weekDayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    @track showAddVisit = false;
    @api recordId; // This will automatically receive the Tour Plan record ID from the record page
    @track beatId;
    @track month;
    @track year;
    @track startDate;
    @track endDate;
    @track showModal = false;
    @track selectedDayVisits = [];
    @track selectedDate;
    @track beatName;
    @track approvalStatus;
    @track userName;
    @track createdDate;
    @track lastModifiedDate;
    @track tourPlanOwnerId;
    @track showRefreshAnimation = false;
    @track showAddVisitModal = false;
    @track searchTerm = '';
    @track accounts = [];
    @track selectedAccount;
    @track visitType = '';
    @track visitTypeOptions = [];
    @track todayVisits = [];
    @track showSelectedModal = false;
    @track selectedVisits = [];
    searchTimeout;
    @track isSearching = false;
    @track filteredVisits = [];
    @track originalVisits = [];

    constructor() {
        super();
        this.isPageLoading = true;
    }

    connectedCallback() {
        this.isPageLoading = true;
        this.handleInitialLoad();
    }

    async handleInitialLoad() {
        try {
            await Promise.all([
                refreshApex(this.wiredTourPlansResult),
                refreshApex(this.wiredVisitsResult)
            ]);
            await this.delay(1000);
        } catch (error) {
            console.error('Error during initial load:', error);
        }
    }

    @wire(getTourPlans, { tourPlanId: '$recordId' })
    wiredTourPlans(result) {
        const { data, error } = result;
        if (data) {
            this.processTourPlanData(data);
            this.isPageLoading = false;
        } else if (error) {
            console.error('Error:', error);
            this.isPageLoading = false;
        }
    }

    processTourPlanData(data) {
        if (data.length > 0) {
            const plan = data[0];
            this.tourPlan = plan;
            this.beatId = plan.Name;
            this.beatName = plan.Beat_Name__c;
            this.month = new Date(plan.Start_Date__c).toLocaleString('default', { month: 'long' });
            this.year = new Date(plan.Start_Date__c).getFullYear();
            this.startDate = plan.Start_Date__c;
            this.endDate = plan.End_Date__c;
            this.approvalStatus = plan.Approval_Status__c;
            this.userName = plan.Owner?.Name;
            this.tourPlanOwnerId = plan.OwnerId;
            this.createdDate = this.formatDate(plan.CreatedDate);
            this.lastModifiedDate = this.formatDate(plan.LastModifiedDate);
            
            // Load calendar visits
            this.loadCalendarVisits();
        }
    }

    loadCalendarVisits() {
        if (this.startDate && this.endDate && this.tourPlanOwnerId) {
            getVisitsForCalendar({
                startDate: this.startDate,
                endDate: this.endDate,
                tourPlanOwnerId: this.tourPlanOwnerId
            })
            .then(result => {
                this.processVisits(result);
            })
            .catch(error => {
                console.error('Error loading calendar visits:', error);
            })
            .finally(() => {
                this.isPageLoading = false;
            });
        }
    }

    processVisits(visits) {
        try {
            console.log('Processing visits:', visits); // Debug log
            const visitsByMonth = {};
            
            visits.forEach(visit => {
                const visitDate = new Date(visit.Planned_start_Date__c);
                const monthYear = `${visitDate.getMonth()}-${visitDate.getFullYear()}`;
                
                if (!visitsByMonth[monthYear]) {
                    visitsByMonth[monthYear] = {};
                }
                
                const dayKey = visitDate.getDate();
                if (!visitsByMonth[monthYear][dayKey]) {
                    visitsByMonth[monthYear][dayKey] = [];
                }
                
                visitsByMonth[monthYear][dayKey].push({
                    id: visit.Id,
                    name: visit.Customer__r.Name,
                    scheduledTime: new Date(visit.Planned_start_Date__c).toLocaleTimeString(),
                    visitFor: visit.Visit_for__c,
                    status: visit.Status__c
                });
            });

            this.calendars = [];
            
            Object.keys(visitsByMonth).forEach(monthYear => {
                const [month, year] = monthYear.split('-').map(Number);
                const calendarMonth = this.createCalendarMonth(month, year, visitsByMonth[monthYear]);
                this.calendars.push(calendarMonth);
            });

            console.log('Processed calendars:', this.calendars); // Debug log

            this.selectedDayVisits = visits.map(visit => ({
                ...visit,
                statusClass: this.getStatusClass(visit.Status__c)
            }));

        } catch (error) {
            console.error('Error processing visits:', error);
        }
    }

    createCalendarMonth(month, year, monthVisits) {
        return {
            monthYear: new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' }),
            yearMonth: `${year}-${month}`,
            days: this.generateDaysForMonth(month, year, monthVisits)
        };
    }

    generateDaysForMonth(month, year, monthVisits) {
        const days = [];
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Add empty days for padding
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push({
                dayNumber: '',
                className: 'calendar-day empty'
            });
        }
        
        // Add days with visits
        for (let date = 1; date <= lastDay.getDate(); date++) {
            const allVisits = monthVisits[date] || [];
            const visitsToShow = allVisits.slice(0, 2);
            const remainingVisits = allVisits.length - 2;

            days.push({
                dayNumber: date,
                key: `${year}-${month + 1}-${date}`,
                className: 'calendar-day',
                visits: visitsToShow,
                hasMoreVisits: remainingVisits > 0,
                moreCount: remainingVisits,
                allVisits: JSON.stringify(allVisits)
            });
        }
        
        return days;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    generateCalendars() {
        if (!this.tourPlan?.Start_Date__c || !this.tourPlan?.End_Date__c) return;

        const startDate = new Date(this.tourPlan.Start_Date__c);
        // Reset time to start of day
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(this.tourPlan.End_Date__c);
        // Reset time to end of day
        endDate.setHours(23, 59, 59, 999);
        
        // Calculate the number of months between start and end date
        const months = (endDate.getMonth() + 12 * endDate.getFullYear()) - 
                      (startDate.getMonth() + 12 * startDate.getFullYear());
        
        this.calendars = [];
        
        // Generate calendar for each month in the range
        for (let i = 0; i <= months; i++) {
            const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            this.calendars.push({
                monthYear: currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
                days: this.generateMonthDays(currentMonth, startDate, endDate)
            });
        }
    }

    generateMonthDays(monthDate, startDate, endDate) {
        const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        
        // Calculate the correct starting point
        const daysArray = [];
        const firstDayOfWeek = firstDay.getDay(); // 0 for Sunday, 1 for Monday, etc.
        
        // Add empty slots for days before the first day of the month
        for (let i = 0; i < firstDayOfWeek; i++) {
            const prevMonthDate = new Date(firstDay);
            prevMonthDate.setDate(prevMonthDate.getDate() - (firstDayOfWeek - i));
            daysArray.push({
                key: `prev-${i}`,
                dayNumber: prevMonthDate.getDate(),
                className: 'calendar-day out-of-month',
                weekDay: this.weekDayHeaders[prevMonthDate.getDay()],
                isCurrentMonth: false
            });
        }

        // Add all days of the current month
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let date = 1; date <= lastDay.getDate(); date++) {
            const currentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), date);
            currentDate.setHours(0, 0, 0, 0);

            const isInRange = currentDate >= startDate && currentDate <= endDate;
            
            daysArray.push({
                key: currentDate.toISOString(),
                dayNumber: date,
                weekDay: this.weekDayHeaders[currentDate.getDay()],
                className: `calendar-day ${isInRange ? 'in-range' : 'out-of-range'} ${
                    this.isSameDay(currentDate, today) ? 'today' : ''
                }`,
                isCurrentMonth: true,
                visits: [],
                hasMoreVisits: false,
                moreCount: 0
            });
        }

        // Add empty slots for days after the last day of the month
        const remainingDays = 42 - daysArray.length;
        for (let i = 1; i <= remainingDays; i++) {
            const nextMonthDate = new Date(lastDay);
            nextMonthDate.setDate(nextMonthDate.getDate() + i);
            daysArray.push({
                key: `next-${i}`,
                dayNumber: nextMonthDate.getDate(),
                className: 'calendar-day out-of-month',
                weekDay: this.weekDayHeaders[nextMonthDate.getDay()],
                isCurrentMonth: false
            });
        }

        return daysArray;
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    get monthYearDisplay() {
        if (!this.tourPlan?.Start_Date__c) return '';
        const date = new Date(this.tourPlan.Start_Date__c);
        return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    formatDate(dateString) {
        if (!dateString) return '--';
        try {
            // Remove any time zone offset that might be present
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '--'; // Check if date is valid
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return '--';
        }
    }

    get startDate() {
        console.log('Getter Called - Start Date:', this.tourPlan?.Start_Date__c);
        return this.formatDate(this.tourPlan?.Start_Date__c);
    }

    get endDate() {
        return this.formatDate(this.tourPlan?.End_Date__c);
    }

    get approvalStatus() {
        return this.approvalStatus || '--';
    }

    get userName() {
        return this.userName || '--';
    }

    get createdDate() {
        return this.createdDate || '--';
    }

    get lastModifiedDate() {
        return this.lastModifiedDate || '--';
    }

    handleAddVisit() {
        this.showAddVisitModal = true;
    }

    closeAddVisitModal() {
        this.showAddVisitModal = false;
        this.selectedVisits = [];
        this.showSelectedModal = false;
        this.visitType = '';
        this.todayVisits = [];
    }

    @wire(getVisitTypes)
    wiredVisitTypes({ error, data }) {
        if (data) {
            this.visitTypeOptions = data.map(type => ({
                label: type,
                value: type
            }));
        } else if (error) {
            this.showToast('Error', 'Error loading visit types', 'error');
        }
    }

    handleVisitTypeChange(event) {
        this.visitType = event.target.value;
        this.loadVisits();
    }

    loadVisits() {
        this.searchTerm = '';
        if (this.visitType) {
            getAccountsByType({ visitType: this.visitType })
                .then(result => {
                    this.todayVisits = result.map(account => ({
                        customerName: account.Name,
                        city: account.BillingCity,
                        ownerName: account.Owner.Name,
                        isSelected: false,
                        iconClass: 'add-icon',
                        iconSymbol: '+'
                    }));
                    // Store original visits for search reset
                    this.originalVisits = [...this.todayVisits];
                })
                .catch(error => {
                    this.error = error;
                    this.todayVisits = [];
                    this.originalVisits = [];
                });
        } else {
            this.todayVisits = [];
            this.originalVisits = [];
        }
    }

    handleToggleSelection(event) {
        const customerId = event.currentTarget.dataset.id;
        this.todayVisits = this.todayVisits.map(visit => {
            if (visit.customerName === customerId) {
                visit.isSelected = !visit.isSelected;
                visit.iconClass = visit.isSelected ? 'delete-icon' : 'add-icon';
                visit.iconSymbol = visit.isSelected ? '×' : '+';
                
                if (visit.isSelected) {
                    this.selectedVisits.push({
                        customerName: visit.customerName,
                        city: visit.city,
                        ownerName: visit.ownerName,
                        date: this.selectedDate
                    });
                } else {
                    this.selectedVisits = this.selectedVisits.filter(
                        v => v.customerName !== visit.customerName
                    );
                }
            }
            return visit;
        });
    }

    handleNext() {
        // Check if date is selected
        if (!this.selectedDate) {
            this.showToast('Error', 'Please select a date before proceeding', 'error');
            return;
        }

        if (this.selectedVisits.length > 0) {
            // Set the initial date for all selected visits
            this.selectedVisits = this.selectedVisits.map(visit => ({
                ...visit,
                date: this.selectedDate
            }));
            this.showSelectedModal = true;
        }
    }

    handleDateChange(event) {
        const selectedDate = new Date(event.target.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time part for accurate date comparison

        if (selectedDate < today) {
            this.showToast('Error', 'Please select today or a future date', 'error');
            event.target.value = this.selectedDate; // Reset to previous valid date
            return;
        }

        const customerName = event.target.name;
        const newDate = event.target.value;
        
        if (customerName) {
            // Update specific visit date
            this.selectedVisits = this.selectedVisits.map(visit => {
                if (visit.customerName === customerName) {
                    return { ...visit, date: newDate };
                }
                return visit;
            });
        } else {
            // Update selected date and all visit dates
            this.selectedDate = newDate;
            this.selectedVisits = this.selectedVisits.map(visit => ({
                ...visit,
                date: newDate
            }));
        }
    }

    saveVisits() {
        if (this.selectedVisits.length === 0) {
            this.showToast('Error', 'Please select visits to save', 'error');
            return;
        }

        const visits = this.selectedVisits.map(visit => ({
            customerName: visit.customerName,
            visitType: this.visitType,
            plannedDate: visit.date
        }));

        createVisits({ 
            visits: visits,
            tourPlanId: this.recordId  // Pass the Tour Plan Id
        })
            .then(() => {
                this.showToast('Success', 'Visits created successfully', 'success');
                this.closeAddVisitModal();
                // Refresh calendar data
                this.loadCalendarVisits();
            })
            .catch(error => {
                console.error('Error creating visits:', error);
                this.showToast(
                    'Error',
                    error.body?.message || 'Error creating visits',
                    'error'
                );
            });
    }

    get noVisitsMessage() {
        return this.visitType ? 'No accounts found for selected type' : 'Please select a visit type';
    }

    handleMoreClick(event) {
        try {
            const date = event.currentTarget.dataset.date;
            const yearMonth = event.currentTarget.dataset.yearmonth;

            if (yearMonth && date) {
                const [year, month] = yearMonth.split('-').map(Number);
                const formattedDate = new Date(Date.UTC(year, month, parseInt(date))).toISOString().split('T')[0];
                
                getVisitsForDate({ 
                    selectedDate: formattedDate,
                    tourPlanOwnerId: this.tourPlanOwnerId
                })
                    .then(result => {
                        console.log('Visits for date:', result);
                        if (result && result.length > 0) {
                            this.selectedDate = `${date}-${month + 1}-${year}`;
                            this.selectedDayVisits = result.map(visit => ({
                                id: visit.Id,
                                name: visit.Customer__r.Name,
                                visitFor: visit.Visit_for__c,
                                status: visit.Status__c,
                                statusClass: this.getStatusClass(visit.Status__c)
                            }));
                            this.showModal = true;
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching visits:', error);
                    });
            }
        } catch (error) {
            console.error('Error in handleMoreClick:', error);
        }
    }

    get isModalVisible() {
        console.log('Modal visibility:', this.showModal);
        return this.showModal;
    }

    closeModal() {
        this.showModal = false;
        this.selectedDayVisits = [];
        this.selectedDate = null;
    }

    getStatusClass(status) {
        const baseClass = 'visit-status ';
        switch(status?.toLowerCase()) {
            case 'completed':
                return baseClass + 'status-completed';
            case 'planned':
                return baseClass + 'status-planned';
            case 'inprogress':
                return baseClass + 'status-inprogress';
            case 'missed':
                return baseClass + 'status-missed';
            default:
                return baseClass + 'status-planned';
        }
    }

    get beatName() {
        return this.beatName || '--';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async refreshPage() {
        this.showRefreshAnimation = true;
        try {
            await Promise.all([
                refreshApex(this.wiredTourPlansResult),
                refreshApex(this.wiredVisitsResult)
            ]);
            await this.delay(2000); // Add small delay for smooth animation
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            this.showRefreshAnimation = false;
        }
    }

    // Add a method to handle refresh button click if needed
    handleRefresh() {
        this.refreshPage();
    }

    // Add new method for handling back button in Selected Items modal
    handleBackToAddVisit() {
        this.showSelectedModal = false; // Hide selected items modal
        // Keep the add visit modal open and maintain its state
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }

    handleSearchInput(event) {
        const searchTerm = event.target.value.toLowerCase();
        this.searchTerm = searchTerm;
        this.isSearching = true;

        // Debounce the search
        window.clearTimeout(this.searchTimeout);
        this.searchTimeout = window.setTimeout(() => {
            if (this.todayVisits) {
                if (!searchTerm) {
                    // If search is cleared, reload original visits
                    this.loadVisits();
                } else {
                    // Filter visits based on search term
                    this.todayVisits = this.todayVisits.filter(visit => 
                        visit.customerName.toLowerCase().includes(searchTerm) ||
                        visit.city?.toLowerCase().includes(searchTerm) ||
                        visit.ownerName?.toLowerCase().includes(searchTerm)
                    );
                }
            }
            this.isSearching = false;
        }, 300);
    }

    get todayDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }
}