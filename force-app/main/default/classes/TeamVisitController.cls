public with sharing class TeamVisitController {
    
    @AuraEnabled(cacheable=true)
    public static List<User> getVisitOwners() {
        try {
            Set<Id> ownerIds = new Set<Id>();
            for(Visit__c visit : [SELECT OwnerId FROM Visit__c]) {
                ownerIds.add(visit.OwnerId);
            }
            
            return [
                SELECT Id, Name 
                FROM User 
                WHERE Id IN :ownerIds
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching executives: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static TeamVisitWrapper getTeamVisitDetails(Date selectedDate, String ownerId) {
        try {
            List<Visit__c> visits = [
                SELECT Id, Customer__r.Name, Status__c, 
                       Planned_start_Date__c, 
                       Checkin_Latitude__c, 
                       Checkin_Longitude__c, 
                       Checkout_Latitude__c, 
                       Checkout_Longitude__c, 
                       OwnerId, Owner.Name
                FROM Visit__c
                WHERE Planned_start_Date__c = :selectedDate
                AND OwnerId = :ownerId
                ORDER BY Actual_start_Time__c ASC
            ];

            Integer completed = 0;
            Integer planned = 0;
            Integer missed = 0;

            for(Visit__c visit : visits) {
                if(visit.Status__c == 'Completed') completed++;
                else if(visit.Status__c == 'Planned') planned++;
                else if(visit.Status__c == 'Missed') missed++;
            }

            return new TeamVisitWrapper(
                visits,
                completed,
                planned,
                missed,
                0,    // Default DA expense
                0     // Default Other expense
            );

        } catch (Exception e) {
            throw new AuraHandledException('Error fetching team visit details: ' + e.getMessage());
        }
    }

    // Wrapper class to hold all the required data
    public class TeamVisitWrapper {
        @AuraEnabled public List<Visit__c> visits { get; set; }
        @AuraEnabled public Integer completedVisits { get; set; }
        @AuraEnabled public Integer plannedVisits { get; set; }
        @AuraEnabled public Integer missedVisits { get; set; }
        @AuraEnabled public Decimal daExpense { get; set; }
        @AuraEnabled public Decimal otherExpense { get; set; }

        public TeamVisitWrapper(
            List<Visit__c> visits,
            Integer completed,
            Integer planned,
            Integer missed,
            Decimal daExpense,
            Decimal otherExpense
        ) {
            this.visits = visits;
            this.completedVisits = completed;
            this.plannedVisits = planned;
            this.missedVisits = missed;
            this.daExpense = daExpense;
            this.otherExpense = otherExpense;
        }
    }
}