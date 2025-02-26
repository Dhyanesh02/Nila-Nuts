public with sharing class VisitLocationController {
    @AuraEnabled(cacheable=true)
    public static List<Visit__c> getVisitLocations(String visitId, Boolean showAllVisits) {
        try {
            if (showAllVisits) {
                // Get today's visits with location data
                Date today = Date.today();
                return [
                    SELECT Id, Name, Customer__r.Name, 
                           Actual_start_Time__c, Actual_End_Time__c,
                           Checkin_Latitude__c, Checkin_Longitude__c,
                           Checkout_Latitude__c, Checkout_Longitude__c,
                           Status__c, Visit_for__c, Distance__c
                    FROM Visit__c 
                    WHERE Planned_start_Date__c = :today
                    AND (
                        (Checkin_Latitude__c != null AND Checkin_Longitude__c != null)
                        OR 
                        (Checkout_Latitude__c != null AND Checkout_Longitude__c != null)
                    )
                    ORDER BY Actual_start_Time__c ASC
                ];
            } else {
                // Get single visit details
                return [
                    SELECT Id, Name, Customer__r.Name, 
                           Actual_start_Time__c, Actual_End_Time__c,
                           Checkin_Latitude__c, Checkin_Longitude__c,
                           Checkout_Latitude__c, Checkout_Longitude__c,
                           Status__c, Visit_for__c, Distance__c
                    FROM Visit__c 
                    WHERE Id = :visitId
                    LIMIT 1
                ];
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving visit locations: ' + e.getMessage());
        }
    }
} 